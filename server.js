import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import {
  CopilotRuntime,
  OpenAIAdapter,
  copilotRuntimeNodeHttpEndpoint,
} from '@copilotkit/runtime';
import OpenAI from 'openai';

// Load environment variables
dotenv.config();

const app = express();

// Enable CORS for Vite dev server
app.use(cors());

// Initialize OpenAI
if (!process.env.OPENAI_API_KEY) {
  console.error('❌ ERROR: OPENAI_API_KEY is not set in your .env file');
  process.exit(1);
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const serviceAdapter = new OpenAIAdapter({ openai });

// Create runtime
const runtime = new CopilotRuntime();

// The endpoint handler will automatically call handleServiceAdapter
// But we can also call it explicitly to ensure the agent is registered
if (serviceAdapter) {
  runtime.handleServiceAdapter(serviceAdapter);
}

const handler = copilotRuntimeNodeHttpEndpoint({
  endpoint: '/copilotkit',
  runtime,
  serviceAdapter,
});

// Add body parser middleware to read request body
app.use(express.json());

// Mount the CopilotKit handler
// Express strips the /copilotkit prefix from req.url, but the handler needs the full path
// So we restore req.url to the original path before calling the handler
app.use('/copilotkit', async (req, res, next) => {
  try {
    // Debug: log incoming requests to see if context is included
    if (req.method === 'POST' && req.body) {
      console.log('[Backend] Received request with body keys:', Object.keys(req.body));
      if (req.body.context) {
        console.log('[Backend] Context received:', JSON.stringify(req.body.context, null, 2));
      } else {
        console.log('[Backend] ⚠️ No context in request body!');
      }
    }
    
    // Save Express's modified URL
    const expressModifiedUrl = req.url;
    // Restore the full path for Hono routing
    const originalUrl = req.originalUrl || req.url;
    
    // For exact /copilotkit match, Express sets req.url to '/' or ''
    if (req.path === '/copilotkit' || req.path === '/') {
      req.url = '/copilotkit';
    } else {
      req.url = originalUrl;
    }
    
    await handler(req, res);
    
    // Restore (though response should be sent by now)
    req.url = expressModifiedUrl;
  } catch (error) {
    console.error('CopilotKit handler error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal server error', message: error.message });
    } else {
      next(error);
    }
  }
});

app.listen(4000, () => {
  console.log('🚀 CopilotKit runtime server running on http://localhost:4000');
  console.log('✅ Endpoint: http://localhost:4000/copilotkit');
});