import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables from .env file
dotenv.config();

// ES module compatibility for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface AppConfig {
  // Server
  port: number;
  host: string;
  nodeEnv: 'development' | 'production' | 'test';
  
  // Database
  databasePath: string;
  
  // OpenAI
  openaiApiKey: string;
  openaiModel: string;
  
  // Study docs (RAG)
  studyDocsPath: string;
}

function getEnvVar(key: string, defaultValue?: string): string {
  const value = process.env[key];
  if (value === undefined) {
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function getEnvVarOptional(key: string, defaultValue: string): string {
  return process.env[key] ?? defaultValue;
}

function validateNodeEnv(env: string): 'development' | 'production' | 'test' {
  if (env === 'development' || env === 'production' || env === 'test') {
    return env;
  }
  return 'development';
}

export function loadConfig(): AppConfig {
  const projectRoot = path.resolve(__dirname, '..', '..');
  
  return {
    // Server
    port: parseInt(getEnvVarOptional('PORT', '3000'), 10),
    host: getEnvVarOptional('HOST', 'localhost'),
    nodeEnv: validateNodeEnv(getEnvVarOptional('NODE_ENV', 'development')),
    
    // Database
    databasePath: path.resolve(
      projectRoot,
      getEnvVarOptional('DATABASE_PATH', 'data/gmat-ascension.db')
    ),
    
    // OpenAI
    openaiApiKey: getEnvVar('OPENAI_API_KEY', ''),
    openaiModel: getEnvVarOptional('OPENAI_MODEL', 'gpt-4o'),
    
    // Study docs
    studyDocsPath: path.resolve(
      projectRoot,
      getEnvVarOptional('STUDY_DOCS_PATH', 'study-docs')
    ),
  };
}

// Singleton config instance
let configInstance: AppConfig | null = null;

export function getConfig(): AppConfig {
  if (!configInstance) {
    configInstance = loadConfig();
  }
  return configInstance;
}

// For testing - allows resetting config
export function resetConfig(): void {
  configInstance = null;
}

export default getConfig;
