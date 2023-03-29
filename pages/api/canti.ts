import { NextApiRequest, NextApiResponse } from 'next';
import { ChatCompletionResponseMessage, Configuration, OpenAIApi } from 'openai';

// Create an OpenAI API client
const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

// Create a type for the chat message
interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// Create a type for UserContext
interface UserContext {
  user_location: string;
  user_weather: string;
}

// Create a type for the session
interface Session {
  id: number;
  messages: ChatMessage[];
}

// In-memory session storage
const sessions: Session[] = [];

// Helper function to find or create a session
const findOrCreateSession = (sessionId: number): Session => {
  let session = sessions.find((session) => session.id === sessionId);

  if (!session) {
    session = { id: sessionId, messages: [] };
    sessions.push(session);
  }

  return session;
};

// Create a multi-line prompt
const prompt = `
You are ChatGPT, a large language model trained by OpenAI.
You are chatting with a human who is asking you questions using voice dictation.
You are trying to answer the questions as best you can.
Be succint and informative unless the user asks you to be more verbose.
`;

// Create a multi-line context
const context = `
For context you can use the following information:
user_location: <user_location>
user_weather: <user_weather>
`;

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method === 'POST') {
    const { sessionId, userMessage, userLocation, userWeather } = req.body;

    const userContext = {
      user_location: userLocation,
      user_weather: userWeather,
    } as UserContext;

    if (typeof sessionId !== 'number' || typeof userMessage !== 'string' || typeof userContext !== 'object') {
      res.status(400).json({ error: 'Invalid request data' });
      return;
    }

    // Fill in the context with the user's context by replacing the placeholders
    const filledContext = context
      .replace('<user_location>', userContext.user_location)
      .replace('<user_weather>', userContext.user_weather)

    const session = findOrCreateSession(sessionId);
    if (session.messages.length === 0) {
      session.messages.push({ role: 'system', content: prompt });
      session.messages.push({ role: 'system', content: filledContext });
    };
    session.messages.push({ role: 'user', content: userMessage });

    try {
      const completion = await openai.createChatCompletion({
        model: 'gpt-3.5-turbo',
        messages: session.messages
      });

      const assistantMessage = completion.data.choices[0].message as unknown;
      session.messages.push({ role: 'assistant', content: assistantMessage as string });

      res.status(200).json({ assistantMessage, messages: session.messages });
    } catch (error) {
      console.error('Error fetching OpenAI response:', error);
      res.status(500).json({ error: 'Failed to contact OpenAI API' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
};

export default handler;
