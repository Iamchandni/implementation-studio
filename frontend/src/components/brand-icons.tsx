'use client';

import { useState } from 'react';

/**
 * Inline brand SVG icons with real brand colors.
 * Used by nodes, palette, connection cards, config panel.
 *
 * Every icon is ViewBox-normalized and inherits `size` (defaults to 20).
 */
import * as React from 'react';

interface BrandIconProps {
  size?: number;
  className?: string;
}

/* ---------------- Slack ---------------- */
export function SlackIcon({ size = 20, className }: BrandIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} xmlns="http://www.w3.org/2000/svg">
      <path fill="#E01E5A" d="M6.194 14.644a2.062 2.062 0 0 1-2.056 2.056A2.062 2.062 0 0 1 2.082 14.644c0-1.128.928-2.056 2.056-2.056h2.056v2.056zm1.038 0c0-1.128.928-2.056 2.056-2.056s2.056.928 2.056 2.056v5.15a2.062 2.062 0 0 1-2.056 2.056 2.062 2.062 0 0 1-2.056-2.056v-5.15z" />
      <path fill="#36C5F0" d="M9.288 6.194a2.062 2.062 0 0 1-2.056-2.056A2.062 2.062 0 0 1 9.288 2.082c1.128 0 2.056.928 2.056 2.056v2.056H9.288zm0 1.038c1.128 0 2.056.928 2.056 2.056s-.928 2.056-2.056 2.056h-5.15A2.062 2.062 0 0 1 2.082 9.288c0-1.128.928-2.056 2.056-2.056h5.15z" />
      <path fill="#2EB67D" d="M17.738 9.288c0-1.128.928-2.056 2.056-2.056s2.056.928 2.056 2.056a2.062 2.062 0 0 1-2.056 2.056h-2.056V9.288zm-1.038 0c0 1.128-.928 2.056-2.056 2.056s-2.056-.928-2.056-2.056v-5.15c0-1.128.928-2.056 2.056-2.056s2.056.928 2.056 2.056v5.15z" />
      <path fill="#ECB22E" d="M14.644 17.738c1.128 0 2.056.928 2.056 2.056a2.062 2.062 0 0 1-2.056 2.056 2.062 2.062 0 0 1-2.056-2.056v-2.056h2.056zm0-1.038a2.062 2.062 0 0 1-2.056-2.056c0-1.128.928-2.056 2.056-2.056h5.15c1.128 0 2.056.928 2.056 2.056a2.062 2.062 0 0 1-2.056 2.056h-5.15z" />
    </svg>
  );
}

/* ---------------- GitHub ---------------- */
export function GitHubIcon({ size = 20, className }: BrandIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} xmlns="http://www.w3.org/2000/svg">
      <path
        fill="currentColor"
        d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56v-1.98c-3.2.7-3.88-1.54-3.88-1.54-.52-1.32-1.28-1.67-1.28-1.67-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.71 1.26 3.37.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.7 0-1.26.45-2.29 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11.02 11.02 0 0 1 5.79 0c2.21-1.49 3.18-1.18 3.18-1.18.63 1.59.23 2.76.11 3.05.74.8 1.19 1.83 1.19 3.09 0 4.43-2.7 5.41-5.27 5.69.41.35.77 1.05.77 2.12v3.14c0 .31.21.68.8.56A11.5 11.5 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5z"
      />
    </svg>
  );
}

/* ---------------- Postgres ---------------- */
export function PostgresIcon({ size = 20, className }: BrandIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} xmlns="http://www.w3.org/2000/svg">
      <path fill="#336791" d="M17.128 0c-3.234 0-5.096.826-6.023 1.532-.244-.02-.494-.031-.75-.032-1.14 0-1.976.243-2.62.573C6.986 1.66 6.008 1.526 4.999 1.527c-1.72 0-3.36.585-4.386 2.076C-.4 5.09-.144 7.36.5 9.906c.32 1.267.744 2.588 1.239 3.826.494 1.239 1.06 2.39 1.744 3.263.34.435.72.827 1.184 1.11.464.286 1.023.464 1.63.464.63 0 1.16-.176 1.61-.482a3.4 3.4 0 0 0 .973-1.083c.4.146.83.246 1.286.246.7 0 1.36-.24 1.943-.708.235.235.492.44.774.6.567.32 1.2.494 1.87.494.643 0 1.257-.16 1.815-.5.558-.34 1.05-.842 1.442-1.457.437.286.917.492 1.423.6.507.108 1.03.114 1.542.014a3.55 3.55 0 0 0 1.416-.594c.417-.29.766-.658 1.028-1.077.523-.845.813-1.884.982-2.99.17-1.104.22-2.294.17-3.42-.05-1.128-.204-2.192-.5-3.03C22.86 3.87 21.7 2.11 20.02 1.13 19.18.64 18.204.36 17.128 0Zm0 .733c1.06.001 1.966.264 2.686.68 1.44.833 2.44 2.4 2.94 3.85.5 1.454.7 3.06.7 4.5 0 1.44-.202 2.716-.7 3.71-.5.994-1.243 1.716-2.286 1.933a3.42 3.42 0 0 1-.7.075c-.35 0-.688-.05-1.007-.15a3.03 3.03 0 0 1-.972-.443c-.293-.203-.55-.442-.766-.71a4.42 4.42 0 0 1-.523-.83c-.135-.28-.244-.567-.336-.848l-.005-.014-.005-.013a5.66 5.66 0 0 1-.14-.55l-.006-.03-.007-.03a5.68 5.68 0 0 1-.05-.303c-.017-.116-.032-.234-.05-.35l-.006-.037-.005-.038-.056-.454v-.006c-.02-.157-.032-.315-.043-.472-.02-.28-.03-.56-.032-.836-.002-.276.005-.55.023-.815l.007-.09c.017-.183.043-.362.084-.535.04-.174.096-.343.17-.5a1.62 1.62 0 0 1 .3-.427c.118-.117.256-.207.416-.256.325-.099.66-.04.936.116l.055.032c.107.062.208.13.303.204.19.148.36.317.514.502.153.185.29.386.412.598.246.427.442.885.6 1.357l.024.075.024.075.043.145.043.145.03.116.03.116c.023.09.043.184.062.278.02.093.037.19.05.286.014.096.023.194.023.29 0 .1-.007.203-.023.303-.017.1-.043.198-.084.284l-.026.048-.026.048c-.03.05-.066.096-.108.14a.9.9 0 0 1-.146.115.85.85 0 0 1-.35.132c-.135.02-.27.014-.4-.014l-.114-.026a.9.9 0 0 1-.104-.033l-.006-.003c-.126-.043-.246-.098-.354-.16a4.14 4.14 0 0 1-.303-.192 2.35 2.35 0 0 1-.244-.216 2 2 0 0 1-.194-.246 1.5 1.5 0 0 1-.14-.28 1.36 1.36 0 0 1-.06-.324c-.005-.058-.006-.117-.006-.176 0-.115.008-.23.026-.343l.006-.037.006-.037c.024-.15.062-.294.11-.437l.014-.042.014-.042c.128-.35.31-.677.542-.968l.023-.03c.083-.104.176-.2.278-.286l.035-.03.035-.028c.084-.07.174-.13.27-.183.096-.053.196-.098.3-.132.104-.033.212-.06.323-.076.11-.017.223-.023.336-.014.114.008.226.03.336.062l.052.017.052.017.05.02.05.02.048.024.048.024c.03.017.06.036.09.056l.024.017.023.017c.06.043.114.09.163.144.05.055.093.115.126.18.033.064.056.132.066.203.01.07.008.14-.006.207a.6.6 0 0 1-.077.196.7.7 0 0 1-.13.157.66.66 0 0 1-.175.107l-.043.017-.043.017-.043.014-.043.013-.05.014-.05.014c-.184.05-.375.075-.567.075h-.008a1.63 1.63 0 0 1-.19-.012L15 8.033l-.044-.008-.044-.008-.024-.005-.024-.006c-.023-.007-.046-.014-.068-.023l-.03-.014-.03-.014c-.03-.017-.057-.036-.083-.058l-.023-.023c-.023-.023-.043-.05-.058-.08l-.006-.017-.006-.017a.29.29 0 0 1-.017-.078l-.001-.006-.001-.006v-.008a.19.19 0 0 1 .003-.05.5.5 0 0 1 .058-.132.75.75 0 0 1 .193-.204c.08-.058.17-.104.267-.14a1.66 1.66 0 0 1 .3-.076c.10-.014.207-.02.31-.017l.028.001.028.002c.033.003.065.008.096.015l.03.007.03.007c.026.008.05.018.075.03l.014.007.014.007c.038.02.073.045.104.075.032.03.06.066.084.106.024.04.043.086.056.135l.006.023.006.023c.015.06.02.122.017.184a.7.7 0 0 1-.014.09l-.014.045-.014.045c-.02.058-.05.11-.084.156a.86.86 0 0 1-.132.14 1.03 1.03 0 0 1-.174.113l-.023.011-.023.011a.83.83 0 0 1-.244.075l-.028.005-.028.005a.86.86 0 0 1-.116.006.86.86 0 0 1-.116-.006l-.028-.005-.028-.005-.023-.005-.023-.005c-.014-.003-.028-.008-.042-.013" transform="scale(0.75) translate(3,3)"/>
      <circle cx="12" cy="12" r="10" fill="#336791" opacity="0.15"/>
      <path fill="#fff" d="M12 4a8 8 0 0 0-1.2 15.9c-.1-.4-.2-1.1 0-1.5.1-.4 1-2.6 1-2.6s-.3-.5-.3-1.3c0-1.2.7-2.1 1.5-2.1.7 0 1.1.6 1.1 1.2 0 .7-.5 1.9-.7 2.9-.2.9.4 1.6 1.3 1.6 1.5 0 2.7-1.6 2.7-3.9 0-2-1.5-3.5-3.5-3.5-2.4 0-3.8 1.8-3.8 3.7 0 .7.3 1.5.6 1.9.1.1.1.1.1.2 0 .1-.1.4-.2.6 0 .1-.1.2-.3.1-1.1-.5-1.7-2.1-1.7-3.4 0-2.7 2-5.2 5.7-5.2 3 0 5.3 2.1 5.3 5 0 3-1.9 5.3-4.5 5.3-.9 0-1.7-.5-2-1 0 0-.4 1.7-.5 2.1-.2.7-.7 1.6-1 2.2A8 8 0 1 0 12 4z"/>
    </svg>
  );
}

/* ---------------- Notion ---------------- */
export function NotionIcon({ size = 20, className }: BrandIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} xmlns="http://www.w3.org/2000/svg">
      <rect width="24" height="24" rx="4" fill="#ffffff" />
      <path fill="#000" d="M4.554 2.686c.741.607 1.02.56 2.412.467l13.146-.79c.28 0 .048-.278-.046-.325L17.906.65C17.534.373 17.023.05 16.05.144L3.32 1.072c-.42.047-.512.28-.35.443l1.583 1.171zm.79 3.087v13.85c0 .743.373 1.024 1.207 0.977L21.15 19.744c.836-.048.93-.56.93-1.163V4.83c0-.605-.232-.93-.744-.883L6.083 4.828c-.558.047-.744.326-.744.943v.002zm14.4 0.744c.093.417 0 .837-.42.884l-.697.14v10.264c-.604.325-1.163.51-1.628.51-.744 0-.93-.232-1.487-.929L11.6 9.943v6.976l1.44.325s0 .837-1.164.837L8.6 18.32c-.093-.187 0-.653.325-.746l.836-.232V8.037l-1.163-.094c-.093-.42.14-1.025.79-1.07l3.483-.234 4.696 7.187V7.514l-1.207-.14c-.093-.512.28-.884.744-.93l3.44-.21z" />
    </svg>
  );
}

/* ---------------- Google Drive ---------------- */
export function GoogleDriveIcon({ size = 20, className }: BrandIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} xmlns="http://www.w3.org/2000/svg">
      <path fill="#0066DA" d="M2.72 15.42l1.4 2.42c.29.51.72.9 1.22 1.19L9.28 12H0c0 .57.14 1.14.43 1.65l2.29 1.77z" transform="translate(0,-2)"/>
      <path fill="#00AC47" d="M12 9L7.72 1.58a2.44 2.44 0 0 0-1.22 1.19L.43 13.16c-.28.5-.43 1.07-.43 1.64h9.28L12 9z" transform="translate(0,-2)"/>
      <path fill="#EA4335" d="M18.28 19.03a2.44 2.44 0 0 0 1.22-1.19l.58-1L23 12l-4.28-7.42a2.44 2.44 0 0 0-2.13-1.19H7.4c.8 0 1.55.42 1.94 1.19L14.72 12l-5.44 8.42a2.24 2.24 0 0 1-1.93 1.15h8.83c.87 0 1.68-.44 2.1-1.14z" transform="translate(0,-2)"/>
      <path fill="#00832D" d="M12 9l4.28-7.42A2.44 2.44 0 0 0 15.06.39H8.94c-.86 0-1.66.45-2.11 1.19L12 9z" transform="translate(0,-2)"/>
      <path fill="#2684FC" d="M16.28 15h-8.5L4 21.42c.42.7 1.16 1.14 2.03 1.14h11.94c.87 0 1.68-.44 2.1-1.14L16.28 15z" transform="translate(0,-2)"/>
      <path fill="#FFBA00" d="M18.28 9.42L14 2A2.44 2.44 0 0 0 11.87.83H9.32L14 9l4.28 7.42a2.44 2.44 0 0 0 .43-1.65L18.28 9.42z" transform="translate(0,-2)"/>
    </svg>
  );
}

/* ---------------- Jira ---------------- */
export function JiraIcon({ size = 20, className }: BrandIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="jiraG1" x1="22.03" y1="16.14" x2="14.99" y2="9.05" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#0052CC"/>
          <stop offset="1" stopColor="#2684FF"/>
        </linearGradient>
        <linearGradient id="jiraG2" x1="1.97" y1="7.86" x2="9.01" y2="14.95" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#0052CC"/>
          <stop offset="1" stopColor="#2684FF"/>
        </linearGradient>
      </defs>
      <path fill="#2684FF" d="M11.53.5H0a5.22 5.22 0 0 0 5.23 5.22h2.13v2.06A5.22 5.22 0 0 0 12.58 13V1.55A1.05 1.05 0 0 0 11.53.5Z"/>
      <path fill="url(#jiraG1)" d="M17.22 6.16H5.69a5.22 5.22 0 0 0 5.23 5.22h2.13v2.06a5.22 5.22 0 0 0 5.22 5.22V7.21a1.05 1.05 0 0 0-1.05-1.05Z"/>
      <path fill="url(#jiraG2)" d="M22.92 11.83H11.38a5.22 5.22 0 0 0 5.23 5.23h2.14v2.05a5.22 5.22 0 0 0 5.22 5.22V12.88a1.05 1.05 0 0 0-1.05-1.05Z"/>
    </svg>
  );
}

/* ---------------- OpenAI ---------------- */
export function OpenAiIcon({ size = 20, className }: BrandIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} xmlns="http://www.w3.org/2000/svg">
      <path
        fill="#10A37F"
        d="M22.28 9.82a5.98 5.98 0 0 0-.52-4.91 6.05 6.05 0 0 0-6.51-2.9A6.06 6.06 0 0 0 4.99 4.16a5.98 5.98 0 0 0-4 2.9 6.05 6.05 0 0 0 .74 7.1 5.98 5.98 0 0 0 .51 4.91 6.05 6.05 0 0 0 6.52 2.9A5.98 5.98 0 0 0 13.26 24a6.05 6.05 0 0 0 5.77-4.2 5.98 5.98 0 0 0 4-2.9 6.05 6.05 0 0 0-.75-7.08zM13.26 22.43a4.48 4.48 0 0 1-2.88-1.04l.14-.08 4.78-2.76c.24-.14.4-.4.4-.68v-6.74l2.02 1.17.02.03v5.58a4.5 4.5 0 0 1-4.48 4.52zM3.6 18.3a4.47 4.47 0 0 1-.54-3.02l.14.08 4.78 2.76c.24.14.53.14.77 0l5.83-3.37v2.33l-.01.03-4.83 2.79a4.5 4.5 0 0 1-6.14-1.6zM2.34 7.9a4.5 4.5 0 0 1 2.35-1.98v5.68a1.55 1.55 0 0 0 .78 1.36l5.8 3.35-2.02 1.16-.03.02-4.83-2.8a4.5 4.5 0 0 1-1.65-6.14zm16.6 3.86l-5.83-3.36 2.02-1.16h.03l4.82 2.79a4.5 4.5 0 0 1-.68 8.12v-5.68c0-.28-.15-.55-.4-.7zm2.01-3.02l-.14-.08-4.78-2.76a.78.78 0 0 0-.78 0l-5.83 3.37V6.96l.02-.03 4.82-2.78a4.5 4.5 0 0 1 6.68 4.66zm-12.63 4.16l-2.02-1.17-.02-.03V6.13a4.5 4.5 0 0 1 7.38-3.44l-.14.08-4.78 2.76a.78.78 0 0 0-.4.68v6.72zm1.1-2.37L12 8.98l2.6 1.5v3l-2.6 1.5-2.6-1.5v-3z"
      />
    </svg>
  );
}

/* ---------------- Azure OpenAI ---------------- */
export function AzureIcon({ size = 20, className }: BrandIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} xmlns="http://www.w3.org/2000/svg">
      <path fill="#0072C6" d="M13.63 2 6.5 22h4.7l1.2-3.5h6.7L23 22h-4.4L13.63 2zm.6 5.1 2.2 6.3h-4.4l2.2-6.3zM1 22l8.4-15 4.6.9L6.7 22H1z"/>
    </svg>
  );
}

/* ---------------- Gmail ---------------- */
export function GmailIcon({ size = 20, className }: BrandIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} xmlns="http://www.w3.org/2000/svg">
      <path fill="#4285F4" d="M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4V10.4l4 2.9 4-2.9V20h4a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z"/>
      <path fill="#34A853" d="M4 20h4V10.4l-4-2.9V20z"/>
      <path fill="#FBBC04" d="M16 20h4V7.5l-4 2.9V20z"/>
      <path fill="#EA4335" d="M4 6l8 5.8L20 6V4H4v2z"/>
      <path fill="#C5221F" d="M2 6l2 1.5V20a2 2 0 0 1-2-2V6z"/>
    </svg>
  );
}

/* ---------------- Google Calendar ---------------- */
export function GoogleCalendarIcon({ size = 20, className }: BrandIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="4" width="18" height="17" rx="2" fill="#FFFFFF" stroke="#DADCE0" strokeWidth="0.5"/>
      <path fill="#4285F4" d="M3 4h18v3H3z"/>
      <path fill="#EA4335" d="M17 3h2v3h-2z"/>
      <path fill="#EA4335" d="M5 3h2v3H5z"/>
      <text x="12" y="17" textAnchor="middle" fontFamily="Arial, sans-serif" fontSize="8" fontWeight="700" fill="#4285F4">31</text>
    </svg>
  );
}

/* ---------------- Zapier (orange) ---------------- */
export function ZapierIcon({ size = 20, className }: BrandIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} xmlns="http://www.w3.org/2000/svg">
      <path fill="#FF4A00" d="M12 2 3 14h7l-1 8 10-12h-7z"/>
    </svg>
  );
}

// Map connectionType -> Icon component
export const BRAND_ICON_MAP: Record<string, React.FC<BrandIconProps>> = {
  slack: SlackIcon,
  github: GitHubIcon,
  postgres: PostgresIcon,
  notion: NotionIcon,
  gdrive: GoogleDriveIcon,
  'google-drive': GoogleDriveIcon,
  jira: JiraIcon,
  openai: OpenAiIcon,
  azure: AzureIcon,
  gmail: GmailIcon,
  'google-calendar': GoogleCalendarIcon,
  google_calendar: GoogleCalendarIcon,
  calendar: GoogleCalendarIcon,
  zapier: ZapierIcon,
};

/**
 * Given an MCP tool name like "gmail_send_email" or "google_calendar_find_events",
 * return the best brand-icon key. Falls back to null when we don't recognise the app.
 */
export function brandKeyFromToolName(toolName?: string | null): string | null {
  if (!toolName) return null;
  const n = toolName.toLowerCase();
  if (n.startsWith('gmail_')) return 'gmail';
  if (n.startsWith('google_calendar_') || n.startsWith('gcal_')) return 'google_calendar';
  if (n.startsWith('google_drive_') || n.startsWith('gdrive_')) return 'gdrive';
  if (n.startsWith('slack_')) return 'slack';
  if (n.startsWith('notion_')) return 'notion';
  if (n.startsWith('jira_')) return 'jira';
  // GitHub native MCP tools have no prefix — match common verb+noun combos.
  if (/^(create|update|delete|get|list|search)_(issue|pull_request|repository|file|branch|comment)/.test(n)) return 'github';
  if (/(^|_)issue|pull_request(s)?|repos?|commit/.test(n)) return 'github';
  return null;
}

/**
 * Maps our internal brand keys to the icon slug used by thesvg.org.
 * If the key isn't in this map, we assume the key IS the slug (e.g. "figma", "stripe").
 * Add overrides here when our key differs from thesvg's naming.
 */
const THESVG_SLUG_OVERRIDES: Record<string, string> = {
  gdrive: 'google-drive',
  'google-drive': 'google-drive',
  google_calendar: 'google-calendar',
  'google-calendar': 'google-calendar',
  calendar: 'google-calendar',
  postgres: 'postgresql',
  azure: 'microsoft-azure',
};

function slugFor(key: string): string {
  const k = key.toLowerCase();
  return THESVG_SLUG_OVERRIDES[k] ?? k.replace(/_/g, '-');
}

/**
 * Renders a brand icon. Strategy:
 *   1. Try the CDN at thesvg.org for the given brand key (~6,400 icons available)
 *   2. If the CDN request fails (offline, blocked, unknown icon), fall back to our
 *      hand-coded SVG map (a handful of core brands: Slack, GitHub, Gmail, etc.)
 *   3. If neither works, render the caller-provided fallback (typically a Lucide icon).
 */
export function BrandIcon({
  type,
  size = 20,
  className,
  fallback,
}: {
  type: string;
  size?: number;
  className?: string;
  fallback?: React.ReactNode;
}) {
  const [cdnFailed, setCdnFailed] = useState(false);
  if (!type) return <>{fallback ?? null}</>;

  const LocalIcon = BRAND_ICON_MAP[type.toLowerCase()];

  // Prefer the CDN; if it errors out (blocked or missing), fall back to a local SVG,
  // and only then to the caller's fallback.
  if (!cdnFailed) {
    const url = `https://thesvg.org/icons/${slugFor(type)}/default.svg`;
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={type}
        width={size}
        height={size}
        className={className}
        style={{ width: size, height: size, objectFit: 'contain' }}
        onError={() => setCdnFailed(true)}
        loading="lazy"
      />
    );
  }
  if (LocalIcon) return <LocalIcon size={size} className={className} />;
  return <>{fallback ?? null}</>;
}
