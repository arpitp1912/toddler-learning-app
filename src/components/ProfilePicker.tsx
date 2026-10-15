import type { Content } from '../content';
import type { Profile } from '../db';
import { Avatar } from './Avatar';

const TINTS = ['peach', 'sky', 'sage', 'butter', 'lilac'] as const;

// Screen 9 (optional). After tap to start, each child taps their own face. No text.
export function ProfilePicker({ profiles, content, onPick }: {
  profiles: Profile[];
  content: Content;
  onPick: (p: Profile) => void;
}) {
  return (
    <div class="screen picker">
      <div class="start-hill" aria-hidden="true" />
      <div class="picker-faces" data-count={Math.min(profiles.length, 6)}>
        {profiles.map((p, i) => (
          <button
            key={p.id}
            class="picker-face"
            data-tint={TINTS[i % TINTS.length]}
            aria-label={p.name}
            onClick={() => onPick(p)}
          >
            <Avatar profile={p} content={content} />
          </button>
        ))}
      </div>
    </div>
  );
}
