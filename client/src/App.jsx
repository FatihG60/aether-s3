import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import OverviewTab from './components/OverviewTab';
import BucketsTab from './components/BucketsTab';
import ObjectsTab from './components/ObjectsTab';
import PresignedTab from './components/PresignedTab';
import ApiKeysTab from './components/ApiKeysTab';
import WebhooksTab from './components/WebhooksTab';

export default function App() {
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState(null);
  const [buckets, setBuckets] = useState([]);
  const [selectedBucket, setSelectedBucket] = useState('');

  const [presignedTarget, setPresignedTarget] = useState({ bucket: '', key: '' });

  useEffect(() => {
    fetchStats();
    fetchBuckets();
  }, []);

  async function fetchStats() {
    try {
      const res = await fetch('/api/stats');
      const data = await res.json();
      if (data.success) {
        setStats(data.stats);
      }
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  }

  async function fetchBuckets() {
    try {
      const res = await fetch('/api/buckets');
      const data = await res.json();
      if (data.success) {
        setBuckets(data.buckets || []);
        if (data.buckets.length > 0 && !selectedBucket) {
          setSelectedBucket(data.buckets[0].name);
        }
      }
    } catch (err) {
      console.error('Failed to fetch buckets:', err);
    }
  }

  function handleSelectBucketAndNavigate(bucketName) {
    setSelectedBucket(bucketName);
    setActiveTab('objects');
  }

  function handleTriggerPresigned(bucketName, key) {
    setPresignedTarget({ bucket: bucketName, key });
    setActiveTab('presigned');
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 selection:bg-blue-500 selection:text-white">
      {/* Top Navbar */}
      <Navbar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        stats={stats} 
      />

      {/* Main Body */}
      <main className="flex-1 max-w-[1720px] w-full mx-auto px-4 sm:px-6 lg:px-10 py-8">
        {activeTab === 'overview' && (
          <OverviewTab 
            stats={stats} 
            onNavigate={(tab) => setActiveTab(tab)} 
          />
        )}

        {activeTab === 'buckets' && (
          <BucketsTab 
            buckets={buckets} 
            fetchBuckets={() => { fetchBuckets(); fetchStats(); }} 
            onSelectBucket={handleSelectBucketAndNavigate} 
          />
        )}

        {activeTab === 'objects' && (
          <ObjectsTab 
            buckets={buckets} 
            selectedBucket={selectedBucket} 
            setSelectedBucket={setSelectedBucket} 
            onGeneratePresigned={handleTriggerPresigned} 
          />
        )}

        {activeTab === 'presigned' && (
          <PresignedTab 
            buckets={buckets} 
            defaultBucket={presignedTarget.bucket} 
            defaultKey={presignedTarget.key} 
          />
        )}

        {activeTab === 'apikeys' && (
          <ApiKeysTab />
        )}

        {activeTab === 'webhooks' && (
          <WebhooksTab />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-white/[0.06] bg-[#05070d] py-6 text-center text-xs text-slate-500">
        <div className="max-w-[1720px] mx-auto px-4 sm:px-6 lg:px-10">
          <p>© 2026 AETHER S3 Custom Object Storage Engine • %100 Özel S3 Motoru ve Web UI Dashboard</p>
        </div>
      </footer>
    </div>
  );
}
