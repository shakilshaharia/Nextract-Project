// Who can do what. Routes ask for a capability, never for a role, so changing
// what an Editor may do is a one-line edit here.

import type { Role } from '../generated/prisma/client.ts';

export const capabilities = [
  'dashboard.view',
  'pages.edit',
  'pages.publish',
  'pages.delete',
  'posts.editAll',
  'posts.editOwn',
  'posts.publish',
  'posts.delete',
  'categories.manage',
  'tags.create',
  'collections.manage',
  'media.upload',
  'media.manageAll',
  'menus.manage',
  'redirects.manage',
  'settings.manage',
  'forms.view',
  'forms.manage',
  'users.manage',
  'activity.view',
  'backups.manage',
  'workflow.review',
  'workflow.bypass',
  'content.portability',
] as const;

export type Capability = (typeof capabilities)[number];

const author: Capability[] = ['dashboard.view', 'posts.editOwn', 'tags.create', 'media.upload'];

const editor: Capability[] = [
  ...author,
  'pages.edit',
  'pages.publish',
  'pages.delete',
  'posts.editAll',
  'posts.publish',
  'posts.delete',
  'categories.manage',
  'collections.manage',
  'media.manageAll',
  'menus.manage',
  'redirects.manage',
  'forms.view',
  'forms.manage',
  'activity.view',
  'workflow.review',
];

const matrix: Record<Role, ReadonlySet<Capability>> = {
  SUPER_ADMIN: new Set(capabilities),
  EDITOR: new Set(editor),
  AUTHOR: new Set(author),
};

export function can(role: Role, capability: Capability) {
  return matrix[role].has(capability);
}

export function capabilitiesFor(role: Role) {
  return [...matrix[role]];
}

export const roleLabels: Record<Role, string> = {
  SUPER_ADMIN: 'Super Admin',
  EDITOR: 'Editor',
  AUTHOR: 'Author',
};
