# Mobile Student Review + SRS Contract (Checkpoint-Centric)

## 1) Student Scores API Contract (Mobile)

### Endpoint
- `GET /api/semesters/current/reviews/student-scores`

### Canonical payload (checkpoint-centric)

```json
{
  "semester": {
    "id": "uuid",
    "code": "SP26",
    "name": "Spring 2026",
    "status": "ACTIVE",
    "current_week": 4,
    "start_date": "2026-01-10T00:00:00.000Z",
    "end_date": "2026-05-10T00:00:00.000Z"
  },
  "groups": [
    {
      "group_id": "uuid",
      "group_name": "Group 1",
      "topic_name": "Project Topic",
      "checkpoints": {
        "checkpoint_1": 7.5,
        "checkpoint_2": null,
        "checkpoint_3": null
      },
      "total_score": 7.5
    }
  ]
}
```

### Mobile rendering rules
- Render score cells in order: `CP1`, `CP2`, `CP3`, `Total`.
- Missing score or `null` must show `-`.
- `total_score` is consumed directly from backend payload.
- Mobile must not recompute total from CP1-CP3.

### Backward compatibility note
- Mobile parser currently supports legacy payload with `milestones` and normalizes it into `groups.checkpoints` shape.
- UI renders from normalized checkpoint-centric groups only.

## 2) Review Status / Timeline (Tracking-only)

### Endpoint
- `GET /api/semesters/current/reviews/student-status`

### Business rule
- Review status/timeline is a progress tracking stream.
- It is displayed in a dedicated timeline section.
- Review timeline data is not mixed into published checkpoint score cards.

## 3) Document Submission Version Model (Mobile)

### Endpoint
- `GET /api/documents/group/:groupId`
- `POST /api/documents/group/:groupId`

### Mobile model

```ts
DocumentSubmission {
  id: string;
  group_id: string;
  base_submission_id?: string | null;
  version_number?: number;
  submitted_by_id: string;
  submitted_by_name?: string | null;
  title: string;
  document_url: string | null;
  reference?: string | null;
  change_summary?: string | null;
  status: 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'GRADED';
  score?: number | null;
  feedback?: string | null;
  created_at: string;
  updated_at?: string;
}
```

### Compatibility rules
- Keep support for legacy `document_url` only rows.
- Support new optional fields: `reference`, `change_summary`.
- Form for new version does not require `document_url`.
- Form can submit title-only, or title + reference, or title + change summary, or both.

## 4) Updated Student UI Flow

### Student Dashboard / Semester Status
- `Published Checkpoint Scores` card: CP1, CP2, CP3, Total.
- `Review Timeline` card: latest review sessions for progress tracking.

### Student Document Version
- `Create new version` form:
  - Required: title.
  - Optional: document URL, reference, change summary.
- `Version History` list shows:
  - version tag (`vN`), status badge, timestamp,
  - reference/link when available,
  - legacy URL when available,
  - change summary and feedback.

## 5) Business Rule Summary
- Checkpoint scores are the published scoring source for student grade visibility.
- Review sessions are activity/timeline data, not the direct source for checkpoint total display.
