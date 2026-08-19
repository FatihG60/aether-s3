import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import OverviewTab from './components/OverviewTab';
import BucketsTab from './components/BucketsTab';
import ObjectsTab from './components/ObjectsTab';
import PresignedTab from './components/PresignedTab';
import ApiKeysTab from './components/ApiKeysTab';
import WebhooksTab from './components/WebhooksTab';
import LifecycleTab from './components/LifecycleTab';
import UsersTab from './components/UsersTab';
import PlaygroundTab from './components/PlaygroundTab';

export default function App() {
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState(null);
  const [buckets, setBuckets] = useState([]);
  const [selectedBucket, setSelectedBucket] = useState('');
  const [users, setUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState({
    id: 1,
    username: 'admin',
    full_name: 'Master Sistem Yöneticisi',
    role: 'ADMIN'
  });

  const [presignedTarget, setPresignedTarget] = useState({ bucket: '', key: '' });

  useEffect(() => {
    fetchStats();
    fetchBuckets();
    fetchUsers();
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

  async function fetchUsers() {
    try {
      const res = await fetch('/api/users');
      const data = await res.json();
      if (data.success && data.users && data.users.length > 0) {
        setUsers(data.users);
        if (!currentUser) {
          setCurrentUser(data.users[0]);
        }
      }
    } catch (err) {
      console.error('Failed to fetch users:', err);
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

  function handleSwitchUser(user) {
    setCurrentUser(user);
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 selection:bg-blue-500 selection:text-white">
      {/* Top Navbar */}
      <Navbar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        stats={stats}
        currentUser={currentUser}
        users={users}
        onSwitchUser={handleSwitchUser}
      />

      {/* Main Body */}
      <main className="flex-1 w-full px-4 sm:px-8 xl:px-12 py-8">
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
            currentUser={currentUser}
          />
        )}

        {activeTab === 'objects' && (
          <ObjectsTab 
            buckets={buckets} 
            selectedBucket={selectedBucket} 
            setSelectedBucket={setSelectedBucket} 
            onGeneratePresigned={handleTriggerPresigned} 
            currentUser={currentUser}
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

        {activeTab === 'lifecycle' && (
          <LifecycleTab buckets={buckets} />
        )}

        {activeTab === 'users' && (
          <UsersTab 
            currentUser={currentUser} 
            onSwitchUser={handleSwitchUser} 
          />
        )}

        {activeTab === 'playground' && (
          <PlaygroundTab buckets={buckets} />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-white/[0.06] bg-[#05070d] py-6 text-center text-xs text-slate-500">
        <div className="w-full px-4 sm:px-8 xl:px-12">
          <p>© 2026 AETHER S3 Custom Object Storage Engine • %100 Özel S3 Motoru ve Web UI Dashboard</p>
        </div>
      </footer>
    </div>
  );
}
