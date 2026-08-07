require('dotenv').config();
const app = require('./app');
const connectDB = require('./config/db');

const PORT = process.env.PORT || 5000;

/**
 * Connect to DB with retry logic
 */
async function connectWithRetry(retries = 5, delayMs = 3000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await connectDB();
      return true;
    } catch (err) {
      console.warn(`⚠️  DB connection attempt ${attempt}/${retries} failed: ${err.message}`);
      if (attempt < retries) {
        console.log(`   Retrying in ${delayMs / 1000}s...`);
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }
  }
  return false;
}

/**
 * Migrate: ensure the employeeId index on Employee collection is sparse.
 * Drops the old non-sparse unique index if present and recreates it sparse.
 */
async function migrateEmployeeIdIndex() {
  try {
    const mongoose = require('mongoose');
    const collection = mongoose.connection.collection('employees');
    const indexes = await collection.indexes();
    const existingIdx = indexes.find(
      idx => idx.key && idx.key.employeeId === 1
    );
    if (existingIdx && !existingIdx.sparse) {
      console.log('🔧 Migrating employeeId index to sparse=true ...');
      await collection.dropIndex(existingIdx.name);
      await collection.createIndex(
        { employeeId: 1 },
        { unique: true, sparse: true, background: true }
      );
      console.log('✅ employeeId index migrated to sparse.');
    }
  } catch (err) {
    console.warn('⚠️  employeeId index migration warning:', err.message);
  }
}

const startServer = async () => {
  const server = app.listen(PORT, () => {
    console.log(`🚀 Marine CRM API running on http://localhost:${PORT}`);
    console.log(`📋 Health check: http://localhost:${PORT}/api/health`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`❌ Error: Port ${PORT} is already in use by another process.`);
      console.error(`   To free port ${PORT}, run: taskkill /F /IM node.exe`);
      process.exit(1);
    } else {
      console.error('❌ Server error:', err);
    }
  });

  const connected = await connectWithRetry(5, 3000);
  if (!connected) {
    console.error('❌ Could not connect to MongoDB after 5 retries. Check MONGODB_URI/network.');
    console.error('   Server is running but DB requests will fail until connection is restored.');
  } else {
    await migrateEmployeeIdIndex();
  }
};

startServer();

process.on('SIGTERM', async () => {
  console.log('SIGTERM received — shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', async () => {
  process.exit(0);
});
