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

    const [users, countResult] = await Promise.all([
      query<any[]>(`
        SELECT 
          u.id, 
          u.name, 
          u.phone, 
          u.dob,
          u.gender,
          u.division,
          u.created_at,
          COUNT(g.id) as total_generations
        FROM users u
        LEFT JOIN generations g ON u.id = g.user_id
        GROUP BY u.id
        ORDER BY u.created_at DESC
        LIMIT ? OFFSET ?
      `, [limit, offset]),
      query<any[]>('SELECT COUNT(*) as total FROM users')
    ]);

    return NextResponse.json({ 
      users, 
      total: countResult[0].total,
      page,
      limit
    });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Admin users error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
