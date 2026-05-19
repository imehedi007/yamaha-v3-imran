'use client';

import { useState, useEffect } from 'react';
import styles from '../admin.module.css';

export default function GenerationsPage() {
  const [generations, setGenerations] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  useEffect(() => {
    fetchGenerations();
  }, [page, limit]);

  const fetchGenerations = async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/generations?page=${page}&limit=${limit}`);
    const data = await res.json();
    if (data.generations) {
      setGenerations(data.generations);
      setTotal(data.total);
    }
    setLoading(false);
  };

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === generations.length) setSelectedIds([]);
    else setSelectedIds(generations.map(g => g.id));
  };

  const handleDelete = async (id: number) => {
    if (confirm('Are you sure you want to delete this record?')) {
      await fetch(`/api/admin/generations?id=${id}`, { method: 'DELETE' });
      fetchGenerations();
    }
  };

  const handleExport = () => {
    const dataToExport = selectedIds.length > 0
      ? generations.filter(g => selectedIds.includes(g.id))
      : generations;

    if (dataToExport.length === 0) return;

    const keys = ['id', 'user_name', 'user_phone', 'gender', 'division', 'bike_model', 'generated_image_url', 'resolved_bike_color', 'created_at'];
    const csvContent = "data:text/csv;charset=utf-8,"
      + keys.join(",") + "\n"
      + dataToExport.map(row => keys.map(k => `"${String(row[k] || '').replace(/"/g, '""')}"`).join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `yamaha_generations_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="fade-in">
      <div className={styles.header}>
        <h1>AI Generations History</h1>
        <div style={{ display: 'flex', gap: '12px' }}>
          <select value={limit} onChange={e => { setLimit(parseInt(e.target.value)); setPage(1); }} className={styles.select} style={{ width: 'auto' }}>
            <option value="20">20 per page</option>
            <option value="40">40 per page</option>
            <option value="60">60 per page</option>
          </select>
          <button className={styles.secondaryBtn} onClick={handleExport}>
            Export {selectedIds.length > 0 ? `Selected (${selectedIds.length})` : 'All'} CSV
          </button>
        </div>
      </div>

      <div className={styles.card}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th style={{ width: '40px' }}>
                <input type="checkbox" checked={selectedIds.length === generations.length && generations.length > 0} onChange={toggleSelectAll} />
              </th>
              <th>Image</th>
              <th>User</th>
              <th>Phone</th>
              <th>Gender</th>
              <th>Division</th>
              <th>Bike</th>
              <th>Color</th>
              <th>Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={10} style={{ textAlign: 'center', padding: '40px' }}>Loading...</td></tr>
            ) : (
              generations.map(gen => (
                <tr key={gen.id} className={selectedIds.includes(gen.id) ? styles.rowSelected : ''}>
                  <td>
                    <input type="checkbox" checked={selectedIds.includes(gen.id)} onChange={() => toggleSelect(gen.id)} />
                  </td>
                  <td>
                    <a href={`/result/${gen.hash_id}`} target="_blank" rel="noopener noreferrer">
                      <img
                        src={gen.generated_image_url}
                        alt="Gen"
                        style={{ width: '24px', height: '24px', borderRadius: '4px', objectFit: 'cover', background: '#222' }}
                        onError={(e) => {
                          (e.target as any).src = "https://via.placeholder.com/24?text=X";
                        }}
                      />
                    </a>
                  </td>
                  <td style={{ fontWeight: 600 }}>{gen.user_name}</td>
                  <td>{gen.user_phone}</td>
                  <td>{gen.gender || 'N/A'}</td>
                  <td>{gen.division || 'N/A'}</td>
                  <td>
                    <span className={styles.badge} style={{ background: 'rgba(0,122,255,0.1)', color: '#007aff' }}>
                      {gen.bike_model}
                    </span>
                  </td>
                  <td style={{ fontSize: '12px', color: 'rgba(255,255,255,0.65)' }}>{gen.resolved_bike_color || 'N/A'}</td>
                  <td style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>
                    {new Date(gen.created_at).toLocaleString()}
                  </td>
                  <td>
                    <button onClick={() => handleDelete(gen.id)} className={styles.dangerBtn} style={{ padding: '4px 8px', fontSize: '10px' }}>Delete</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        <div className={styles.pagination}>
          <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className={styles.secondaryBtn}>Previous</button>
          <span>Page {page} of {totalPages || 1} ({total} total)</span>
          <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)} className={styles.secondaryBtn}>Next</button>
        </div>
      </div>
    </div>
  );
}
