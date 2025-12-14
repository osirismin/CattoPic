# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- **ZIP Batch Upload** - Upload images in bulk via ZIP archive
  - Browser-side extraction using JSZip
  - Batch processing (50 images per batch) to prevent memory overflow
  - Real-time extraction and upload progress display
  - Unified tag setting for all images
  - Auto-skip non-image files and files over 70MB

### Changed

- Use Cloudflare Transform Images URL (`/cdn-cgi/image/...`) as a fallback WebP/AVIF delivery method when stored variants are missing (e.g. uploads over 10MB).
- `/api/random` now redirects (302) to the selected image URL instead of proxying the image bytes (more reliable for transformed variants).
- Disable Next.js image optimization since images are already delivered as transformed URLs.
- Transform-URL parameters now follow the configured settings (no extra flags; no forced AVIF resize unless a max size is specified).

### Fixed

- Fix deleted images not disappearing from Upload/Manage pages without a hard refresh (TanStack Query cache + recent uploads list).
- Fix Manage page Random API generator to resolve the real API base URL (via `/api/config`) instead of the placeholder `https://your-worker.workers.dev`.
