import { beforeEach, describe, expect, it, vi } from 'vitest';
import { playNotificationSound } from '../../src/background/sound.js';

// Mock storage so getCustomSound is controllable without touching browser.storage.
vi.mock('../../src/shared/storage.js', () => ({
  getCustomSound: vi.fn().mockResolvedValue(null),
}));

import { getCustomSound } from '../../src/shared/storage.js';

function makeAudioMock(playResult = Promise.resolve()) {
  const mock = { volume: 1, play: vi.fn().mockReturnValue(playResult) };
  return mock;
}

describe('playNotificationSound', () => {
  let AudioSpy;

  beforeEach(() => {
    AudioSpy = vi.spyOn(globalThis, 'Audio').mockImplementation(() => makeAudioMock());
    getCustomSound.mockResolvedValue(null);
    browser.runtime.getURL.mockImplementation((path) => `ext://${path}`);
  });

  it('does nothing when notificationSoundEnabled is false', async () => {
    await playNotificationSound({ notificationSoundEnabled: false });
    expect(AudioSpy).not.toHaveBeenCalled();
  });

  it('does nothing when settings is nullish', async () => {
    await playNotificationSound(null);
    expect(AudioSpy).not.toHaveBeenCalled();
  });

  it('plays the default sound URL when type is "default"', async () => {
    await playNotificationSound({
      notificationSoundEnabled: true,
      notificationSoundType: 'default',
      notificationSoundVolume: 0.5,
    });
    expect(browser.runtime.getURL).toHaveBeenCalledWith('sounds/default.wav');
    expect(AudioSpy).toHaveBeenCalledWith('ext://sounds/default.wav');
  });

  it('clamps volume to [0, 1]', async () => {
    let capturedAudio;
    AudioSpy.mockImplementation(() => {
      capturedAudio = makeAudioMock();
      return capturedAudio;
    });

    await playNotificationSound({
      notificationSoundEnabled: true,
      notificationSoundType: 'default',
      notificationSoundVolume: 5,
    });
    expect(capturedAudio.volume).toBe(1);

    await playNotificationSound({
      notificationSoundEnabled: true,
      notificationSoundType: 'default',
      notificationSoundVolume: -1,
    });
    expect(capturedAudio.volume).toBe(0);
  });

  it('uses custom dataUrl when type is "custom" and sound is stored', async () => {
    getCustomSound.mockResolvedValue({ dataUrl: 'data:audio/wav;base64,abc' });
    await playNotificationSound({
      notificationSoundEnabled: true,
      notificationSoundType: 'custom',
      notificationSoundVolume: 0.7,
    });
    expect(AudioSpy).toHaveBeenCalledWith('data:audio/wav;base64,abc');
  });

  it('falls back to default when custom sound has no dataUrl', async () => {
    getCustomSound.mockResolvedValue({});
    await playNotificationSound({
      notificationSoundEnabled: true,
      notificationSoundType: 'custom',
      notificationSoundVolume: 0.7,
    });
    expect(browser.runtime.getURL).toHaveBeenCalledWith('sounds/default.wav');
  });

  it('does not throw when audio.play() rejects', async () => {
    AudioSpy.mockImplementation(() => makeAudioMock(Promise.reject(new Error('blocked'))));
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await expect(
      playNotificationSound({
        notificationSoundEnabled: true,
        notificationSoundType: 'default',
        notificationSoundVolume: 0.7,
      }),
    ).resolves.toBeUndefined();
    expect(warnSpy).toHaveBeenCalledWith('[geething] sound playback failed:', 'Error');
    warnSpy.mockRestore();
  });
});
