import { NextResponse } from 'next/server';
import { query } from '@/lib/server/mysql';
import { verifyAuth, getAuthCookie } from '@/lib/server/auth';

async function checkAdmin() {
  const token = await getAuthCookie();
  if (!token) throw new Error('Unauthorized');
  await verifyAuth(token);
}

export async function GET(req: Request) {
  try {
    await checkAdmin();
    
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    const [generations, countResult] = await Promise.all([
      query<any[]>(`
        SELECT 
          g.id,
          g.hash_id,
          g.generated_image_url,
          g.persona_title,
          g.resolved_bike_color,
          g.created_at,
          u.id as user_id,
          u.name as user_name,
          u.phone as user_phone,
          u.gender,
          u.division,
          b.model_name as bike_model
        FROM generations g
        JOIN users u ON g.user_id = u.id
        JOIN bikes b ON g.bike_id = b.id
        ORDER BY g.created_at DESC
        LIMIT ? OFFSET ?
      `, [limit, offset]),
      query<any[]>('SELECT COUNT(*) as total FROM generations')
    ]);

    return NextResponse.json({ 
      generations, 
      total: countResult[0].total,
      page,
      limit
    });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Admin generations error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    await checkAdmin();

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Generation ID is required' }, { status: 400 });
    }

    await query('DELETE FROM generations WHERE id = ?', [id]);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Admin generations delete error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
