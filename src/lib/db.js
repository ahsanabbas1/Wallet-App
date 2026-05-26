import * as SQLite from 'expo-sqlite';
import { runMigrations } from './schema';

// One connection object per userId, keyed by userId
const _dbs = {};
const _opening = {};
let _activeUserId = null;

export async function openUserDatabase(userId) {
  if (_dbs[userId]) {
    _activeUserId = userId;
    return _dbs[userId];
  }
  if (_opening[userId]) {
    await _opening[userId];
    _activeUserId = userId;
    return _dbs[userId];
  }
  _opening[userId] = (async () => {
    const db = await SQLite.openDatabaseAsync(`user_${userId}.db`);
    await runMigrations(db);
    _dbs[userId] = db;
  })();
  await _opening[userId];
  delete _opening[userId];
  _activeUserId = userId;
  return _dbs[userId];
}

// Returns the active DB — throws if called before openUserDatabase
export function getDb() {
  if (!_activeUserId || !_dbs[_activeUserId]) {
    throw new Error('No active database. Call openUserDatabase first.');
  }
  return _dbs[_activeUserId];
}

export async function closeUserDatabase(userId) {
  if (_dbs[userId]) {
    await _dbs[userId].closeAsync();
    delete _dbs[userId];
    if (_activeUserId === userId) _activeUserId = null;
  }
}

export function getActiveUserId() {
  return _activeUserId;
}

export function generateId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}
