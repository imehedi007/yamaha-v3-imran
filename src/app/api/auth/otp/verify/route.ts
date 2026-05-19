import { NextResponse } from 'next/server';
import { query } from '@/lib/server/mysql';
import { z } from 'zod';
import { cookies } from 'next/headers';
import { SignJWT } from 'jose';

const verifyOtpSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().min(10).max(15),
  dob: z.string().optional(),
  gender: z.enum(['Male', 'Female']),
  division: z.enum(['Dhaka', 'Chattogram', 'Rajshahi', 'Khulna', 'Barishal', 'Sylhet', 'Rangpur', 'Mymensingh']),
  otp: z.string().length(4)
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const result = verifyOtpSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }

    const { name, phone, dob, gender, division, otp } = result.data;

    // Verify OTP from DB
    const otps = await query<any[]>(
      `SELECT id FROM otps 
       WHERE phone = ? AND otp_code = ? AND is_used = FALSE AND expires_at > NOW() 
       ORDER BY created_at DESC LIMIT 1`,
      [phone, otp]
    );

    if (otps.length === 0) {
      return NextResponse.json({ error: 'Invalid or expired OTP' }, { status: 400 });
    }

    // Mark OTP as used
    await query(`UPDATE otps SET is_used = TRUE WHERE id = ?`, [otps[0].id]);

    // Check if user exists, else create
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
      // Optionally update name/dob if provided
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

    // Create user session token using jose
    const secret = process.env.OTP_SECRET || 'fallback_secret_please_change';
    const token = await new SignJWT({ userId, phone })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('2h')
      .sign(new TextEncoder().encode(secret));

    // Set cookie
    const cookieStore = await cookies();
    cookieStore.set('user_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 60 * 60 * 2 // 2 hours
    });

    return NextResponse.json({ success: true, userId });
  } catch (error) {
    console.error('Verify OTP error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
