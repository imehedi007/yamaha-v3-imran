'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import styles from './page.module.css';

export default function Home() {
  const router = useRouter();
  const [step, setStep] = useState<'lead' | 'otp'>('lead');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [dob, setDob] = useState('25-34');
  const [gender, setGender] = useState('Male');
  const [division, setDivision] = useState('Dhaka');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Auto-redirect if already verified
  useEffect(() => {
    if (localStorage.getItem('isAuthenticated') === 'true') {
      router.push('/quiz');
    }
  }, [router]);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !phone || !dob || !gender || !division) {
      setError('Please fill in all fields');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, dob, gender, division }),
      });
      const data = await res.json();

      if (res.ok) {
        if (data.bypassOtp) {
          localStorage.setItem('isAuthenticated', 'true');
          router.push('/quiz');
        } else {
          setStep('otp');
        }
      } else {
        setError(data.error || 'Failed to send OTP');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length !== 4) {
      setError('OTP must be 4 digits');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, dob, gender, division, otp }),
      });
      const data = await res.json();

      if (res.ok) {
        localStorage.setItem('isAuthenticated', 'true');
        router.push('/quiz');
      } else {
        setError(data.error || 'Invalid OTP');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="page-container">
      <div className={`${styles.card} fade-in`}>
        {step === 'lead' && (
          <>
            {/* <h1 style={{ fontSize: '24px', textAlign: 'center', marginBottom: '8px' }}>Your Profile</h1>
            <p className={styles.subtitle} style={{ fontSize: '14px', marginBottom: '32px' }}>
              Join the elite Yamaha community.
            </p> */}

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div className={styles.badge}>Powered by AI</div>
              <h3 className={styles.title}>Unleash Your Ride Personality</h3>
            </div>

            {error && <div className={styles.error}>{error}</div>}

            <form onSubmit={handleSendOtp}>
              <div className={styles.formGroup}>
                <label>Full Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your name"
                  required
                />
              </div>
              <div className={styles.formGroup}>
                <label>Age Range</label>
                <select
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                  required
                >
                  <option value="" disabled>Select your age range</option>
                  <option value="18-24">18-24</option>
                  <option value="25-34">25-34</option>
                  <option value="35-44">35-44</option>
                  <option value="45-55">45-55</option>
                  <option value="55+">55+</option>
                </select>
              </div>
              <div className={styles.formGroup}>
                <label>Phone Number</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. 017XXXXXXXX"
                  required
                />
              </div>
              <div className={styles.formGroup}>
                <label>Gender</label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  required
                >
                  <option value="" disabled>Select your gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
              </div>
              <div className={styles.formGroup}>
                <label>Division</label>
                <select
                  value={division}
                  onChange={(e) => setDivision(e.target.value)}
                  required
                >
                  <option value="" disabled>Select your division</option>
                  <option value="Dhaka">Dhaka</option>
                  <option value="Chattogram">Chattogram</option>
                  <option value="Rajshahi">Rajshahi</option>
                  <option value="Khulna">Khulna</option>
                  <option value="Barishal">Barishal</option>
                  <option value="Sylhet">Sylhet</option>
                  <option value="Rangpur">Rangpur</option>
                  <option value="Mymensingh">Mymensingh</option>
                </select>
              </div>
              <button type="submit" className="primary-button" disabled={loading}>
                {loading ? 'Processing...' : 'Continue'}
              </button>
            </form>
          </>
        )}

        {step === 'otp' && (
          <div className={styles.otpContainer}>
            <h1 style={{ fontSize: '24px', textAlign: 'center', marginBottom: '8px' }}>Security Check</h1>
            <p className={styles.subtitle} style={{ fontSize: '14px', marginBottom: '32px' }}>
              Enter the code sent to <b>{phone}</b>
            </p>

            {error && <div className={styles.error}>{error}</div>}

            <form onSubmit={handleVerifyOtp}>
              <div className={styles.formGroup}>
                <input
                  type="text"
                  maxLength={4}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="••••"
                  style={{ textAlign: 'center', letterSpacing: '8px', fontSize: '24px' }}
                  required
                />
              </div>
              <button type="submit" className="primary-button" disabled={loading}>
                {loading ? 'Verifying...' : 'Verify Identity'}
              </button>
            </form>
            <div className={styles.otpActions}>
              <button className={styles.resendBtn} onClick={() => setStep('lead')} disabled={loading}>
                Change Number
              </button>
              <button className={styles.resendBtn} onClick={handleSendOtp} disabled={loading} style={{ marginLeft: '16px' }}>
                Resend OTP
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
