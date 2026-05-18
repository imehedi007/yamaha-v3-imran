import { NextResponse } from 'next/server';
import { query } from '@/lib/server/mysql';
import { generateCinematicImage, generatePersonaCopy } from '@/lib/server/gemini';
import { buildImagePrompt, parsePersonaPayload, selectBikeForPersona } from '@/lib/server/ride-persona';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';

async function getGenerationByHashId(hashId: string) {
  const generations = await query<any[]>(
    `SELECT hash_id, generated_image_url, traits_summary, status
     FROM generations
     WHERE hash_id = ?
     LIMIT 1`,
    [hashId]
  );

  return generations[0] || null;
}

function normalizeRequestId(value: FormDataEntryValue | null) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().toLowerCase();
  return /^[a-f0-9]{32}$/.test(trimmed) ? trimmed : null;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const requestId = normalizeRequestId(searchParams.get('requestId'));

    if (!requestId) {
      return NextResponse.json({ error: 'Invalid request ID' }, { status: 400 });
    }

    const generation = await getGenerationByHashId(requestId);

    if (!generation) {
      return NextResponse.json({ status: 'not_found' });
    }

    return NextResponse.json({
      status: generation.status,
      generationId: generation.hash_id,
      imageUrl: generation.generated_image_url,
      personaCopy: generation.traits_summary,
    });
  } catch (error) {
    console.error('Generate status API error:', error);
    return NextResponse.json({ error: 'Failed to check generation status.' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const startedAt = Date.now();
  const checkpoints: Record<string, number> = {};
  let activeHashId: string | null = null;
  let reservedGeneration = false;
  const mark = (label: string) => {
    checkpoints[label] = Date.now() - startedAt;
    console.log(`[api/generate] ${label} at ${checkpoints[label]}ms`);
  };

  try {
    // We expect a multipart/form-data request
    const formData = await req.formData();
    mark('form-data-parsed');
    const photo = formData.get('photo') as File;
    const persona = formData.get('persona') as string;
    const requestId = normalizeRequestId(formData.get('requestId'));

    if (!photo || !persona) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Authenticate user
    const cookieStore = await cookies();
    const token = cookieStore.get('user_token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let userId: number;
    try {
      const secret = process.env.OTP_SECRET || 'fallback_secret_please_change';
      const verified = await jwtVerify(token, new TextEncoder().encode(secret));
      userId = verified.payload.userId as number;
      mark('auth-verified');
    } catch (err) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    if (requestId) {
      const existingGeneration = await getGenerationByHashId(requestId);

      if (existingGeneration) {
        mark('existing-generation-found');
        return NextResponse.json({
          success: true,
          generationId: existingGeneration.hash_id,
          imageUrl: existingGeneration.generated_image_url,
          personaCopy: existingGeneration.traits_summary,
          status: existingGeneration.status,
        });
      }
    }

    // Rate Limiting Check
    const settings = await query<any[]>('SELECT setting_key, setting_value FROM app_settings');
    const getSetting = (key: string, def: number) => {
      const s = settings.find(x => x.setting_key === key);
      return s ? parseInt(s.setting_value, 10) : def;
    };
    
    const maxDaily = getSetting('max_daily_generations', 10);
    const maxWeekly = getSetting('max_weekly_generations', 50);
    const maxMonthly = getSetting('max_monthly_generations', 100);

    const [dailyCountRes, weeklyCountRes, monthlyCountRes] = await Promise.all([
      query<any[]>('SELECT COUNT(*) as count FROM generations WHERE user_id = ? AND created_at > NOW() - INTERVAL 1 DAY', [userId]),
      query<any[]>('SELECT COUNT(*) as count FROM generations WHERE user_id = ? AND created_at > NOW() - INTERVAL 1 WEEK', [userId]),
      query<any[]>('SELECT COUNT(*) as count FROM generations WHERE user_id = ? AND created_at > NOW() - INTERVAL 1 MONTH', [userId])
    ]);
    mark('rate-limit-checked');

    if (dailyCountRes[0].count >= maxDaily) {
      return NextResponse.json({ error: `You have reached the daily limit of ${maxDaily} images. Please try again tomorrow.` }, { status: 429 });
    }
    if (weeklyCountRes[0].count >= maxWeekly) {
      return NextResponse.json({ error: `You have reached the weekly limit of ${maxWeekly} images. Please try again next week.` }, { status: 429 });
    }
    if (monthlyCountRes[0].count >= maxMonthly) {
      return NextResponse.json({ error: `You have reached the monthly limit of ${maxMonthly} images. Please try again next month.` }, { status: 429 });
    }

    // Convert photo to base64
    const arrayBuffer = await photo.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64Image = buffer.toString('base64');
    const mimeType = photo.type;
    mark('photo-encoded');

    let personaData;
    try {
      personaData = parsePersonaPayload(persona);
      mark('persona-parsed');
    } catch (e: any) {
      console.error('Persona parsing error:', e);
      return NextResponse.json({ error: 'Quiz data is invalid. Please retake the quiz.' }, { status: 400 });
    }

    const selection = await selectBikeForPersona(personaData);
    mark('bike-selected');
    const bikeId = selection.bike.id;
    const bikeModel = selection.bike.model_name;
    const bikeColor = selection.resolvedColor;
    const destinationScene = personaData.destination_meta?.scene || personaData.destination || 'premium scenic road';
    const destinationMood = personaData.destination_meta?.personality || `${personaData.destination} rider energy`;
    const aspirationTone = personaData.aspiration || 'signature rider energy';

    const crypto = await import('crypto');
    const hashId = requestId || crypto.randomBytes(16).toString('hex');
    activeHashId = hashId;

    try {
      await query(
        `INSERT INTO generations (
          user_id,
          bike_id,
          behavior_option_id,
          destination_option_id,
          aspiration_option_id,
          generated_image_url,
          persona_title,
          traits_summary,
          resolved_bike_color,
          selection_meta,
          hash_id,
          status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          userId,
          bikeId,
          personaData.behavior,
          personaData.destination_id,
          personaData.aspiration_id,
          null,
          persona,
          null,
          bikeColor,
          JSON.stringify(selection.selectionMeta),
          hashId,
          'processing',
        ]
      );
      reservedGeneration = true;
      mark('generation-reserved');
    } catch (reservationError: any) {
      if (reservationError?.code === 'ER_DUP_ENTRY') {
        const existingGeneration = await getGenerationByHashId(hashId);
        mark('existing-generation-found');
        return NextResponse.json({
          success: true,
          generationId: hashId,
          imageUrl: existingGeneration?.generated_image_url || null,
          personaCopy: existingGeneration?.traits_summary || null,
          status: existingGeneration?.status || 'processing',
        });
      }

      throw reservationError;
    }

    console.log('[api/generate] Generating persona copy and image in parallel...');
    const personaSummary = `${destinationMood} with ${aspirationTone.toLowerCase()}`;
    
    const finalPrompt = buildImagePrompt({
      bikeModel,
      bikeColor,
      destinationScene,
      destinationMood,
      aspiration: aspirationTone,
    });
    console.log('[api/generate] Final image prompt:', finalPrompt);

    // Run both AI tasks concurrently to reduce response latency
    const [personaCopy, generatedImageUrl] = await Promise.all([
      generatePersonaCopy(personaSummary, bikeModel),
      generateCinematicImage(base64Image, mimeType, finalPrompt).catch((aiError: any) => {
        console.error('Gemini Image Generation Error:', aiError);
        throw new Error(`AI Generation failed: ${aiError.message || 'Unknown AI error'}`);
      })
    ]);
    mark('ai-complete');

    // Upload to AWS S3 instead of local public folder
    console.log('[api/generate] Uploading to S3...');
    const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
    
    // Convert base64 data URI to buffer
    const base64Data = generatedImageUrl.replace(/^data:image\/\w+;base64,/, "");
    const imgBuffer = Buffer.from(base64Data, 'base64');
    
    const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
    const bucketName = process.env.S3_BUCKET_NAME;
    
    if (!bucketName) {
      throw new Error('S3_BUCKET_NAME is not configured in .env.local');
    }

    const fileName = `generations/gen_${hashId}.jpg`;
    
    try {
      const s3Command = new PutObjectCommand({
        Bucket: bucketName,
        Key: fileName,
        Body: imgBuffer,
        ContentType: 'image/jpeg',
        ACL: 'public-read' // Make it publicly accessible
      });
      
      await s3Client.send(s3Command);
      mark('s3-uploaded');
    } catch (s3Error: any) {
      console.error('S3 Upload Error:', s3Error);
      throw new Error(`S3 Upload failed: ${s3Error.message || 'Check AWS credentials and Bucket Block Public Access settings'}`);
    }

    const publicS3Url = `https://${bucketName}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${fileName}`;

    // Save to database
    console.log('[api/generate] Saving to database...');
    await query(
      `UPDATE generations
       SET generated_image_url = ?,
           traits_summary = ?,
           status = ?
       WHERE hash_id = ?`,
      [
        publicS3Url,
        personaCopy,
        'completed',
        hashId,
      ]
    );
    mark('db-saved');
    reservedGeneration = false;

    // Clear the OTP session token so they must verify again to generate another image
    const cookieStoreForDelete = await cookies();
    cookieStoreForDelete.delete('user_token');
    mark('cookie-cleared');

    console.log('[api/generate] completed', {
      totalMs: Date.now() - startedAt,
      checkpoints,
      uploadedPhotoBytes: buffer.length,
      encodedPhotoBase64Chars: base64Image.length,
      generatedImageBase64Chars: generatedImageUrl.length,
    });

    return NextResponse.json({
      success: true,
      generationId: hashId,
      imageUrl: publicS3Url,
      personaCopy,
      status: 'completed'
    });

  } catch (error: any) {
    if (reservedGeneration && activeHashId) {
      try {
        await query(
          `UPDATE generations
           SET status = ?
           WHERE hash_id = ?`,
          ['failed', activeHashId]
        );
      } catch (updateError) {
        console.error('Failed to mark generation as failed:', updateError);
      }
    }

    console.error('Generate API error:', error);
    console.error('[api/generate] failed', {
      totalMs: Date.now() - startedAt,
      checkpoints,
      error: error.message,
    });
    
    // Provide granular error messages back to the user
    let errorMessage = 'Image generation failed. Please try again.';
    
    if (error.message) {
      const msg = error.message.toLowerCase();
      if (msg.includes('503') || msg.includes('overloaded')) {
        errorMessage = 'AI servers are currently overloaded. Please try again in a few moments.';
      } else if (msg.includes('safety') || msg.includes('blocked') || msg.includes('policy')) {
        errorMessage = 'The generated image was blocked by AI safety filters. Please try a different photo.';
      } else if (msg.includes('payload') || msg.includes('no image')) {
        errorMessage = 'The AI model failed to construct the image. Please try a different photo or angle.';
      }
    }
    
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
