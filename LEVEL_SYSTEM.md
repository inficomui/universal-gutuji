# Level System Implementation

## Overview
A level system has been implemented to organize videos into different levels, allowing for individual video content for each level.

## Database Schema

### Level Model (`models/Level.ts`)
- **id**: Primary key (auto-increment)
- **name**: Level name (unique, required, 2-100 characters)
- **isActive**: Boolean flag for soft delete (default: true)
- **createdAt/updatedAt**: Timestamps

### Video Model Updates (`models/Video.ts`)
- **levelId**: Foreign key reference to Level model (optional)
- Added index for efficient level-based queries
- Added validation for levelId field

## API Endpoints

### Level Management (`/api/levels`)

#### Public Routes (Authenticated Users)
- `GET /api/levels` - Get all levels
- `GET /api/levels/active` - Get only active levels
- `GET /api/levels/:id` - Get single level by ID
- `GET /api/levels/:id/videos` - Get videos for a specific level

#### Admin Routes (Admin Only)
- `POST /api/levels` - Create new level
- `PUT /api/levels/:id` - Update level
- `DELETE /api/levels/:id` - Soft delete level (sets isActive to false)

### Video Management Updates (`/api/videos`)

#### Enhanced Routes
- `GET /api/videos?levelId=:levelId` - Get videos with optional level filtering
- `GET /api/videos/level/:levelId` - Get videos by specific level
- `POST /api/videos` - Create video (now accepts levelId)
- `PUT /api/videos/:id` - Update video (now accepts levelId)

## Usage Examples

### Creating a Level
```bash
POST /api/levels
{
  "name": "Beginner Level"
}
```

### Creating a Video with Level
```bash
POST /api/videos
{
  "key": "video-001",
  "title": "Introduction Video",
  "description": "Basic introduction",
  "levelId": 1
}
```

### Getting Videos by Level
```bash
GET /api/videos/level/1
```

### Getting All Videos with Level Filter
```bash
GET /api/videos?levelId=1
```

## Database Relationships
- Video belongs to Level (optional)
- Level has many Videos
- Soft delete: When level is deleted, videos' levelId is set to NULL

## Features
- ✅ Level CRUD operations
- ✅ Video-level association
- ✅ Level-based video filtering
- ✅ Soft delete for levels
- ✅ Input validation
- ✅ Admin-only level management
- ✅ Public video access with level filtering
