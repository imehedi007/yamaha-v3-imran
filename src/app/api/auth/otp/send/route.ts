import { NextResponse } from 'next/server';
import { query } from '@/lib/server/mysql';
import { sendSMS } from '@/lib/server/bulksmsbd';
import { z } from 'zod';
import { cookies } from 'next/headers';
import { SignJWT } from 'jose';

const sendOtpSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().min(10).max(15),
  dob: z.string().optional(),
  gender: z.enum(['Male', 'Female']),
  division: z.enum(['Dhaka', 'Chattogram', 'Rajshahi', 'Khulna', 'Barishal', 'Sylhet', 'Rangpur', 'Mymensingh']),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const result = sendOtpSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ error: 'Invalid phone number' }, { status: 400 });
    }

    const { name, phone, dob, gender, division } = result.data;

    // Check if OTP is disabled in settings
    const settings = await query<any[]>("SELECT setting_value FROM app_settings WHERE setting_key = 'otp_enabled'");
    const otpEnabled = settings.length > 0 ? settings[0].setting_value !== 'false' : true;

    if (!otpEnabled) {
      // Bypass OTP flow
      let users = await query<any[]>(`SELECT id FROM users WHERE phone = ?`, [phone]);
      let userId: number;

      if (users.length === 0) {
        if (!name) {
          return NextResponse.json({ error: 'Name is required for new users' }, { status: 400 });
        }
        const insertResult = await query<any>(
          `INSERT INTO users (name, phone, dob, gender, division) VALUES (?, ?, ?, ?, ?)`,
          [name, phone, dob, gender, division]
        );
        userId = insertResult.insertId;
      } else {
        userId = users[0].id;
        if (name || dob || gender || division) {
          let updateSql = 'UPDATE users SET ';
          const params: any[] = [];
          if (name) {
            updateSql += 'name = ?, ';
            params.push(name);
          }
          if (dob) {
            updateSql += 'dob = ?, ';
            params.push(dob);
          }
          if (gender) {
            updateSql += 'gender = ?, ';
            params.push(gender);
          }
          if (division) {
            updateSql += 'division = ?, ';
            params.push(division);
          }
          updateSql = updateSql.slice(0, -2) + ' WHERE id = ?';
          params.push(userId);
          await query(updateSql, params);
        }
      }

      // Create session token
      const secret = process.env.OTP_SECRET || 'fallback_secret_please_change';
      const token = await new SignJWT({ userId, phone })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('2h')
        .sign(new TextEncoder().encode(secret));

      const cookieStore = await cookies();
      cookieStore.set('user_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
        maxAge: 60 * 60 * 2 // 2 hours
      });

      return NextResponse.json({ success: true, bypassOtp: true, userId });
    }

    // Rate limiting: check if OTP was sent recently (e.g. last 1 minute)
    const recentOtps = await query<any[]>(
      `SELECT id FROM otps WHERE phone = ? AND created_at > NOW() - INTERVAL 1 MINUTE`,
      [phone]
    );

    if (recentOtps.length > 0) {
      return NextResponse.json({ error: 'Please wait before requesting another OTP' }, { status: 429 });
    }

    // Generate 4 digit OTP
    const otpCode = Math.floor(1000 + Math.random() * 9000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    // Save to DB
    await query(
      `INSERT INTO otps (phone, otp_code, expires_at) VALUES (?, ?, ?)`,
      [phone, otpCode, expiresAt]
    );

    // Send SMS
    const message = `Your Yamaha AI Ride Personality OTP is ${otpCode}. Valid for 5 minutes.`;
    const smsSent = await sendSMS(phone, message);

    if (!smsSent) {
      return NextResponse.json({ error: 'Failed to send OTP SMS' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'OTP sent successfully' });
  } catch (error) {
    console.error('Send OTP error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
