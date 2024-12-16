import { initializeOpenAI } from '../config/openai.js';
import Anthropic from '@anthropic-ai/sdk';
import { https } from 'firebase-functions/v2';

export class SummarizationService {
  constructor(claudeApiKey, openaiApiKey) {
    this.claude = new Anthropic({ apiKey: claudeApiKey });
    this.openai = initializeOpenAI(openaiApiKey);
    this.CLAUDE_MAX_TOKENS = 100000 * 0.5;
    this.GPT4_MAX_TOKENS = 8192 * 0.5;
    this.summarizeFunction = https.onCall({
      timeoutSeconds: 90,  // 3600 Up to 1 hour for v2
      memory: '1GiB',       // Note: Uses GiB instead of GB in v2
      minInstances: 0,      // Optional: minimum number of instances
      maxInstances: 100     // Optional: maximum number of instances
    });
  }

  countTokens(text) {
    // console.log(`Counting tokens for text length: ${text.length}`);
    // Use simple estimation method: ~4 characters per token
    return Math.ceil(text.length / 4);
  }

  splitIntoChunks(text, maxTokens) {
    console.log(`Splitting into chunks`);
    const chunks = [];
    // Split the text by time annotations like [1:15] and remove them
    const segments = text.split(/\[\d+:\d+\]\s*/).filter(segment => segment.trim() !== '');
    let currentChunk = '';
    let currentTokens = 0;

    for (const segment of segments) {
      const segmentTokens = this.countTokens(segment);
      
      if (segmentTokens > maxTokens) {
        // Further split the segment if it exceeds maxTokens
        const sentences = segment.match(/[^.!?]+[.!?]+/g) || [segment];
        for (const sentence of sentences) {
          const sentenceTokens = this.countTokens(sentence);
          if (sentenceTokens > maxTokens) {
            // Split the long sentence into smaller parts based on words
            const words = sentence.split(' ');
            for (const word of words) {
              const wordTokens = this.countTokens(word + ' ');
              if (currentTokens + wordTokens > maxTokens) {
                if (currentChunk) {
                  chunks.push(currentChunk.trim());
                }
                currentChunk = word + ' ';
                currentTokens = wordTokens;
              } else {
                currentChunk += word + ' ';
                currentTokens += wordTokens;
              }
            }
          } else if (currentTokens + sentenceTokens > maxTokens) {
            if (currentChunk) {
              chunks.push(currentChunk.trim());
            }
            currentChunk = sentence;
            currentTokens = sentenceTokens;
          } else {
            currentChunk += sentence;
            currentTokens += sentenceTokens;
          }
        }
      } else if (currentTokens + segmentTokens > maxTokens) {
        if (currentChunk) {
          chunks.push(currentChunk.trim());
        }
        currentChunk = segment;
        currentTokens = segmentTokens;
      } else {
        currentChunk += segment;
        currentTokens += segmentTokens;
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }

  async summarizeWithClaude(transcript) {
    console.log(`Summarizing with Claude`);
    const tokenCount = this.countTokens(transcript);
    console.log(`Token count: ${tokenCount}`);
    
    if (tokenCount <= this.CLAUDE_MAX_TOKENS) {
      const message = await this.claude.messages.create({
        model: "claude-3-sonnet-20240229",
        max_tokens: 40000,
        messages: [{
          role: "user",
          content: `Please provide a comprehensive summary of this transcript, covering all key points: ${transcript}`
        }]
      });
      return {
        summary: message.content[0].text,
        provider: 'claude'
      };
    }

    // Reduce chunk size to leave room for prompt and response
    const CHUNK_SIZE = Math.floor(this.CLAUDE_MAX_TOKENS);
    const chunks = await this.splitIntoChunks(transcript, CHUNK_SIZE);
    console.log(`Split transcript into ${chunks.length} chunks`);
    
    const chunkSummaries = await Promise.all(
      chunks.map(async (chunk, index) => {
        const message = await this.claude.messages.create({
          model: "claude-3-sonnet-20240229",
          max_tokens: 4000,
          messages: [{
            role: "user",
            content: `This is part ${index + 1} of ${chunks.length} of a longer transcript. Please provide a detailed summary of this part, ensuring to capture all important information: ${chunk}`
          }]
        });
        console.log(`Completed summary for chunk ${index + 1}`);
        return message.content[0].text;
      })
    );

    if (chunkSummaries.length > 1) {
      const finalMessage = await this.claude.messages.create({
        model: "claude-3-sonnet-20240229",
        max_tokens: 4000,
        messages: [{
          role: "user",
          content: `Please combine these ${chunkSummaries.length} summary parts into a comprehensive final summary, ensuring all parts are equally represented and no information is lost. Each part represents a different section of the transcript:\n\n${chunkSummaries.map((summary, index) => `Part ${index + 1}:\n${summary}`).join('\n\n')}`
        }]
      });
      return {
        summary: finalMessage.content[0].text,
        provider: 'claude'
      };
    }

    return {
      summary: chunkSummaries[0],
      provider: 'claude'
    };
  }

  async summarizeWithGPT(transcript) {
    console.log(`Summarizing with GPT`);
    try {
      const tokenCount = this.countTokens(transcript);
      console.log(`Token count: ${tokenCount}`);
      if (tokenCount <= this.GPT4_MAX_TOKENS) {
        const completion = await this.openai.chat.completions.create({
          model: "gpt-4",
          messages: [{
            role: "user",
            content: `Please provide a comprehensive summary of this transcript, covering all key points: ${transcript}`
          }],
          max_tokens: 4000,
          temperature: 0.5,
        });

        return {
          summary: completion.choices[0].message.content,
          provider: 'gpt'
        };
      }

      // Reduce chunk size to leave room for prompt and response
      const CHUNK_SIZE = Math.floor(this.GPT4_MAX_TOKENS);
      const chunks = await this.splitIntoChunks(transcript, CHUNK_SIZE);
      console.log(`Split transcript into ${chunks.length} chunks for GPT processing`);

      const chunkSummaries = await Promise.all(
        chunks.map(async (chunk, index) => {
          try {
            console.log(`Summarizing chunk ${index + 1} of ${chunks.length}`);
            console.log(`Chunk size: ${chunk.length}`);
            const completion = await this.openai.chat.completions.create({
              model: "gpt-4",
              messages: [{
                role: "user",
                content: `This is part ${index + 1} of ${chunks.length} of a longer transcript. Please provide a detailed summary of this part, ensuring to capture all important information: ${chunk}`
              }],
              max_tokens: 4000,
              temperature: 0.5,
            });
            console.log(`Completed GPT summary for chunk ${index + 1}`);
            return completion.choices[0].message.content;
          } catch (error) {
            throw new Error(`Failed to summarize chunk ${index + 1}: ${this.formatGPTError(error)}`);
          }
        })
      );

      if (chunkSummaries.length > 1) {
        try {
          const finalCompletion = await this.openai.chat.completions.create({
            model: "gpt-4",
            messages: [{
              role: "user",
              content: `Please combine these ${chunkSummaries.length} summary parts into a comprehensive final summary, ensuring all parts are equally represented and no information is lost. Each part represents a different section of the transcript:\n\n${chunkSummaries.map((summary, index) => `Part ${index + 1}:\n${summary}`).join('\n\n')}`
            }],
            max_tokens: 4000,
            temperature: 0.5,
          });

          return {
            summary: finalCompletion.choices[0].message.content,
            provider: 'gpt'
          };
        } catch (error) {
          throw new Error(`Failed to combine summaries: ${this.formatGPTError(error)}`);
        }
      }

      return {
        summary: chunkSummaries[0],
        provider: 'gpt'
      };
    } catch (error) {
      console.error('GPT API error:', error);
      throw this.formatGPTError(error);
    }
  }

  formatGPTError(error) {
    // Handle specific OpenAI error types
    if (error.response?.status === 429) {
      return new Error('Rate limit exceeded. Please try again later.');
    }
    
    if (error.response?.status === 401) {
      return new Error('Invalid API key or unauthorized access.');
    }

    if (error.response?.status === 503) {
      return new Error('OpenAI service is temporarily unavailable. Please try again later.');
    }

    if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
      return new Error('Connection to OpenAI failed. Please check your internet connection.');
    }

    // Handle OpenAI specific error messages
    const message = error.response?.data?.error?.message || 
                   error.message || 
                   'An unexpected error occurred with GPT service';

    if (message.includes('insufficient_quota')) {
      return new Error('OpenAI API quota exceeded. Please check your billing status.');
    }

    if (message.includes('context_length_exceeded')) {
      return new Error('Input text is too long for GPT-4 to process.');
    }

    // If it's already an Error instance with a formatted message, return it
    if (error instanceof Error && error.message.includes('Failed to')) {
      return error;
    }

    return new Error(`GPT summarization failed: ${message}`);
  }

  async summarize(transcript) {
    try {
      return await this.summarizeWithClaude(transcript);
    } catch (claudeError) {
      console.log('Claude API failed, falling back to GPT:', claudeError);
      
      // Check if it's a credit balance or invalid request error
      if (claudeError?.error?.error?.type === 'invalid_request_error' || 
          claudeError.status === 400 || 
          claudeError.message?.includes('credit balance') ||
          (claudeError?.error?.type === 'error' && 
           claudeError?.error?.error?.type === 'invalid_request_error' && 
           claudeError?.error?.error?.message?.includes('credit balance'))) {
        try {
          return await this.summarizeWithGPT(transcript);
        } catch (gptError) {
          console.error('GPT fallback also failed:', gptError);
          // gptError will already be formatted by formatGPTError
          throw new Error(`Both summarization services failed. Claude: ${claudeError.message}. GPT: ${gptError.message}`);
        }
      }
      console.error('Unexpected Claude error structure:', claudeError);
      throw new Error(`Claude summarization failed: ${claudeError.message}`);
    }
  }
} 