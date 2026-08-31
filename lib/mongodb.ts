import "server-only";

import { MongoClient, type Db } from "mongodb";

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB ?? "qmind";

if (!uri) {
  throw new Error("Missing MONGODB_URI. Copy .env.example to .env.local.");
}

const mongoUri: string = uri;

/**
 * Next.js App Router handlers behave like serverless functions: each instance
 * keeps its own pool. A small pool avoids leaking idle connections to MongoDB
 * (~1MB RAM each) across warm isolates.
 */
const options = {
  maxPoolSize: 5,
  minPoolSize: 0,
  maxIdleTimeMS: 30_000,
};

type GlobalMongo = typeof globalThis & {
  _mongoClientPromise?: Promise<MongoClient>;
};

const globalForMongo = globalThis as GlobalMongo;

function getClientPromise() {
  if (!globalForMongo._mongoClientPromise) {
    const client = new MongoClient(mongoUri, options);
    globalForMongo._mongoClientPromise = client.connect();
  }
  return globalForMongo._mongoClientPromise;
}

const clientPromise = getClientPromise();

export async function getDb(): Promise<Db> {
  const client = await clientPromise;
  return client.db(dbName);
}
