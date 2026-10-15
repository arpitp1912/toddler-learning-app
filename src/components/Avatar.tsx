import { asset, itemById, type Content } from '../content';
import type { Profile } from '../db';
import { usePhotoUrl } from '../photos';

/** A profile's face: its photo, or its preset item on a tinted disc. */
export function Avatar({ profile, content, class: cls = '' }: { profile: Profile; content: Content; class?: string }) {
  const photo = usePhotoUrl(profile.avatarPhoto);
  const preset = itemById(content, profile.avatar) ?? content.items[0];
  return (
    <span class={`avatar ${cls}`} aria-hidden="true">
      {photo ? (
        <img class="avatar-photo" src={photo} alt="" />
      ) : (
        preset && <img class="avatar-art art" src={asset(preset.image)} alt="" />
      )}
    </span>
  );
}
