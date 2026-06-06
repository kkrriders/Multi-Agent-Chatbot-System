'use strict';

jest.mock('../../../src/services/ai/provider-manager');

const ai = require('../../../src/services/ai/provider-manager');
const { transcribe } = require('../../../src/services/speech/whisper-transcriber');

describe('whisper-transcriber', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns trimmed transcript on success', async () => {
    ai.transcribeAudio.mockResolvedValue({ text: '  Hello world.  ', provider: 'groq' });
    const result = await transcribe(Buffer.from('audio data'), 'audio/webm');
    expect(result).toBe('Hello world.');
    expect(ai.transcribeAudio).toHaveBeenCalledWith(expect.any(Buffer), 'audio/webm');
  });

  test('throws for non-Buffer input', async () => {
    await expect(transcribe('not a buffer', 'audio/webm')).rejects.toThrow('non-empty Buffer');
  });

  test('throws for empty buffer', async () => {
    await expect(transcribe(Buffer.alloc(0), 'audio/webm')).rejects.toThrow('non-empty Buffer');
  });

  test('throws when audio exceeds 25 MB', async () => {
    const huge = Buffer.alloc(26 * 1024 * 1024);
    await expect(transcribe(huge, 'audio/webm')).rejects.toThrow('25 MB');
  });

  test('propagates AI provider errors', async () => {
    ai.transcribeAudio.mockRejectedValue(new Error('Groq 429'));
    const buf = Buffer.from('some audio');
    await expect(transcribe(buf, 'audio/webm')).rejects.toThrow('Groq 429');
  });

  test('handles empty transcript from AI gracefully', async () => {
    ai.transcribeAudio.mockResolvedValue({ text: '', provider: 'groq' });
    const result = await transcribe(Buffer.from('silence'), 'audio/webm');
    expect(result).toBe('');
  });
});
