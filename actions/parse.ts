"use server";

import csv from "csv-parser";
import { Writable } from "stream";

// Define the type for a parsed application row
interface ApplicationDataRow {
  [key: string]: string;
}

/**
 * A custom writable stream to collect parsed CSV data.
 * This is necessary because `csv-parser` works with streams, and we need to collect all the data before returning it.
 */
class ArrayStream extends Writable {
  private data: ApplicationDataRow[] = [];
  constructor() {
    super({ objectMode: true });
  }

  _write(chunk: any, encoding: string, callback: () => void): void {
    this.data.push(chunk);
    callback();
  }

  getData(): ApplicationDataRow[] {
    return this.data;
  }
}

/**
 * Parses a CSV string using csv-parser and returns the data as an array of objects.
 * This function runs on the server.
 */
export async function parseCSV(csvContent: string): Promise<ApplicationDataRow[]> {
  return new Promise((resolve, reject) => {
    const results: ApplicationDataRow[] = [];
    const arrayStream = new ArrayStream();

    arrayStream.on('finish', () => {
      resolve(arrayStream.getData());
    });

    arrayStream.on('error', (error) => {
      reject(error);
    });

    const parser = csv();
    parser.write(csvContent);
    parser.end();

    parser.pipe(arrayStream);
  });
}