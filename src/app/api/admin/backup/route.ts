import { NextRequest, NextResponse } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';
import { getAuthenticatedUser } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
  const user = getAuthenticatedUser(req);
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
  }

  // Ensure latest backup exists
  const backupResult = db.createBackup();
  if (!backupResult.success || !backupResult.filePath) {
    return NextResponse.json(
      { error: 'Failed to create backup: ' + (backupResult.error || 'Unknown error') },
      { status: 500 }
    );
  }

  try {
    const fileBuffer = fs.readFileSync(backupResult.filePath);
    const filename = path.basename(backupResult.filePath);

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/x-sqlite3',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(fileBuffer.length),
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to read backup file' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const user = getAuthenticatedUser(req);
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
  }

  const result = db.createBackup();
  const info = db.getDatabaseInfo();

  return NextResponse.json({
    ok: result.success,
    error: result.error,
    info,
  });
}
