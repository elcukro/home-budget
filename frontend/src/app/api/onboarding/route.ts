import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const FILE_PATH = path.join(DATA_DIR, 'onboarding-submissions.json');

export async function GET() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });

    const content = await fs.readFile(FILE_PATH, 'utf8').catch(async (error) => {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        await fs.writeFile(FILE_PATH, '[]', 'utf8');
        return '[]';
      }
      throw error;
    });

    const parsed = JSON.parse(content);

    return NextResponse.json(parsed);
  } catch (error) {
    console.error('[onboarding][GET] Failed to read submissions', error);
    return NextResponse.json(
      { success: false, error: 'Failed to read onboarding data' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    await fs.mkdir(DATA_DIR, { recursive: true });

    let existing: unknown[] = [];
    try {
      const content = await fs.readFile(FILE_PATH, 'utf8');
      existing = JSON.parse(content);
      if (!Array.isArray(existing)) {
        existing = [];
      }
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === 'ENOENT') {
        existing = [];
      } else {
        throw error;
      }
    }

    existing.push(payload);

    await fs.writeFile(FILE_PATH, JSON.stringify(existing, null, 2), 'utf8');

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[onboarding][POST] Failed to persist submission', error);
    return NextResponse.json(
      { success: false, error: 'Failed to persist onboarding data' },
      { status: 500 }
    );
  }
}
