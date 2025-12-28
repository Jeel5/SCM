import { defineConfig } from 'prisma/config';
import dotenv from 'dotenv';

// Load environment variables for Prisma CLI usage
dotenv.config({ path: './.env' });

export default defineConfig({
  schema: './prisma/schema.prisma',
  datasource: {
    url: process.env.DATABASE_URL!,
  },
});
