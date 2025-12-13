# Cloud Database Analysis & Recommendation

## Project Aegis - Mobile Incident Reporting

**Date:** December 13, 2025  
**Project:** Project Aegis - Offline-First Incident Reporting System

---

## 1. Current Data Structure Analysis

### Incident Model

```typescript
interface Incident {
  id: string; // UUID - Primary Key
  type: string; // Landslide, Flood, Road Block, Power Line Down
  severity: number; // 1-5 scale
  latitude: number; // GPS coordinate
  longitude: number; // GPS coordinate
  timestamp: number; // Unix timestamp
  status: "pending" | "synced" | "failed"; // Sync status
  created_at: number; // Creation timestamp
  updated_at: number; // Last update timestamp
}
```

### Sync Flow

- Mobile app creates incidents locally in SQLite
- When internet is restored, app sends incidents to backend via `/api/sync` endpoint
- Backend receives array of incidents as JSON
- Backend updates incidents with `synced` status
- Web admin dashboard reads all incidents for analysis and visualization

### Data Requirements

- **Write-heavy:** Mobile app creating incidents frequently
- **Read pattern:** Web admin dashboard reading/filtering incidents
- **Geographic data:** Latitude/longitude for mapping
- **Real-time:** New incidents should appear in admin dashboard immediately after sync
- **Low latency:** Sync operation should complete in < 5 seconds
- **Scale:** Starting with thousands of incidents, potentially millions in production

---

## 2. Cloud Database Options Comparison

### Option 1: **Firebase Firestore** ⭐ RECOMMENDED

**Best for rapid development, real-time updates, and scalability**

#### Pros ✅

- **Real-time sync:** Changes reflected instantly in web admin dashboard
- **Zero infrastructure:** No server management needed
- **Built-in authentication:** Easy user/role management
- **Offline support:** Mobile SDK with offline persistence
- **Automatic scaling:** Handles traffic spikes without configuration
- **Geographic queries:** Built-in geolocation support
- **REST API:** Easy integration with mobile app
- **Free tier:** 1 GB storage, 50,000 reads/day (perfect for MVP)
- **Web dashboard:** Can build admin dashboard with Firestore SDK
- **Pricing:** $0.06 per 100,000 reads, $0.18 per 100,000 writes

#### Cons ❌

- **Not relational:** Limited JOIN operations (denormalization needed)
- **Eventual consistency:** May have slight delays in reads
- **Document size limit:** 1 MB per document (not an issue for incidents)
- **No complex filtering:** Limited WHERE clauses compared to SQL

#### Architecture

```
Mobile App (SQLite)
    ↓
    └─→ Backend API
         └─→ [POST /api/sync]
              └─→ Firestore Collection: incidents
                   └─→ Web Admin Dashboard (Real-time listener)
```

#### Cost Estimate (Monthly)

- Typical incident (0.5 KB): 100,000 incidents/month
- Reads: 150,000 (admin dashboard) = **$9**
- Writes: 100,000 (mobile sync) = **$18**
- Storage: 50 GB = **$5**
- **Total: ~$32/month**

---

### Option 2: **AWS DynamoDB**

**Best for high-throughput, distributed scenarios**

#### Pros ✅

- **Extremely fast:** Single-digit millisecond latency
- **High throughput:** Handles millions of requests/sec
- **Global distribution:** Multi-region replication available
- **Managed:** No infrastructure management
- **Encryption:** Built-in at rest and in transit
- **Pay-per-request:** Only pay for what you use

#### Cons ❌

- **Learning curve:** Complex query language (Query vs Scan)
- **Expensive reads:** Scans are very costly (full table scans)
- **No real-time:** Requires Lambda + API Gateway for updates
- **Vendor lock-in:** AWS-specific tooling
- **Pricing complexity:** Hard to predict costs initially

#### Cost Estimate (Monthly)

- On-demand pricing: 100,000 writes = **$25**
- 150,000 reads = **$7.50**
- Storage (50 GB) = **$12.50**
- **Total: ~$45/month**

---

### Option 3: **MongoDB Atlas**

**Best for flexible schema and aggregation pipelines**

#### Pros ✅

- **Flexible schema:** Easy to add new incident types
- **Rich queries:** Powerful aggregation pipeline
- **Geospatial indexes:** Built-in for location queries
- **Real-time change streams:** Watch collections for updates
- **Community:** Largest NoSQL community
- **Free tier:** 512 MB shared cluster (development only)

#### Cons ❌

- **Requires management:** Needs replica set configuration
- **Network latency:** Extra hop to MongoDB servers
- **Connection pooling:** Must manage for efficient queries
- **Pricing:** Expensive for small scale
- **Real-time updates:** Requires change streams + websockets

#### Cost Estimate (Monthly)

- Shared cluster (development): **Free** (limited)
- Dedicated M0: **$9**
- M2 (production): **$18-50/month**
- **Total: $18-50/month** (varies by config)

---

### Option 4: **PostgreSQL (AWS RDS/Supabase)**

**Best for relational data and complex queries**

#### Pros ✅

- **Relational:** Easy to maintain data relationships
- **PostGIS extension:** Advanced geographic queries
- **Powerful queries:** Full SQL support
- **Transactions:** ACID compliance for data integrity
- **Mature:** Battle-tested in production
- **Self-hosted option:** Run on your own server

#### Cons ❌

- **Requires server:** Need to manage backend API
- **Connection pooling:** Must implement for scalability
- **DevOps overhead:** Database management, backups, security
- **Not real-time:** Requires polling or websockets
- **Complex setup:** More infrastructure to maintain

#### Cost Estimate (Monthly - AWS RDS)

- db.t3.micro: **$16**
- db.t3.small: **$32**
- Storage (50 GB): **$5**
- Backups: **$5**
- **Total: $26-42/month**

---

### Option 5: **Supabase** (PostgreSQL + Real-time)

**Best for real-time PostgreSQL with auto-generated API**

#### Pros ✅

- **PostgreSQL power:** Full SQL with PostGIS
- **Real-time:** Built-in real-time subscriptions
- **Auto-generated API:** REST API from schema (Row Level Security)
- **Authentication:** User management included
- **Dashboard:** Built-in web UI for data management
- **Open source:** Can self-host
- **Free tier:** Good for development

#### Cons ❌

- **Relatively new:** Smaller community than PostgreSQL
- **Pricing transparency:** Can be expensive at scale
- **Performance:** Real-time on large tables can be slow
- **Vendor lock-in:** Supabase-specific features

#### Cost Estimate (Monthly)

- Free tier: **$0** (5 GB database, up to 100 concurrent connections)
- Pro: **$25** (100 GB, 500 concurrent connections)
- **Total: $0-25/month**

---

## 3. ⭐ RECOMMENDATION: Firebase Firestore

### Why Firestore is BEST for Project Aegis

1. **Real-Time Admin Dashboard**

   - Web admin dashboard automatically updates when new incidents sync
   - No polling needed - instant visibility
   - Perfect for emergency response scenarios

2. **Simple Integration**

   - Mobile app already uses REST API
   - Backend API simply writes to Firestore instead of PostgreSQL
   - Firestore SDK handles all database logic

3. **Geographic Queries**

   - Built-in support for lat/long queries
   - Filter incidents by region or proximity
   - Essential for incident mapping

4. **Cost-Effective**

   - Free tier covers MVP development
   - Scales with usage, not infrastructure
   - No server management costs

5. **Security**

   - Role-based access control (Admin, Viewer, Responder)
   - User authentication integrated
   - Encryption by default

6. **Web Admin Dashboard**
   - Can build with React + Firestore SDK
   - Real-time updates with listeners
   - No backend API needed for dashboard (direct DB access)

---

## 4. Implementation Architecture

### Recommended Setup: Firebase Firestore + Backend API

```
┌─────────────────────────────────────────────────────────────┐
│                     MOBILE APP (Expo)                       │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Local SQLite (Offline Storage)                       │   │
│  │ - Creates incidents in airplane mode                 │   │
│  │ - Status: pending                                    │   │
│  └──────────────────────────────────────────────────────┘   │
│                           ↓                                  │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Sync Service (NetInfo listener)                      │   │
│  │ - POST /api/sync when online                         │   │
│  │ - Send pending incidents + auth token               │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│              BACKEND API (Node.js + Express)                │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Authentication Handler                               │   │
│  │ - Verify JWT/Bearer token from mobile app            │   │
│  │ - Validate user permissions                          │   │
│  └──────────────────────────────────────────────────────┘   │
│                           ↓                                  │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ POST /api/sync Endpoint                              │   │
│  │ - Extract incident data                              │   │
│  │ - Normalize/validate incident fields                 │   │
│  │ - Add metadata (user_id, synced_at, etc)             │   │
│  └──────────────────────────────────────────────────────┘   │
│                           ↓                                  │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Firestore Service                                    │   │
│  │ - Write incidents to Firestore collection            │   │
│  │ - Update incident status to 'synced'                 │   │
│  │ - Handle batch writes for efficiency                 │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                           ↓
        ┌──────────────────┴──────────────────┐
        ↓                                      ↓
┌──────────────────────────────┐    ┌──────────────────────────────┐
│  FIRESTORE DATABASE          │    │  FIRESTORE REALTIME SYNC     │
│  Collection: incidents       │    │  Live Dashboard Updates      │
│  ├─ id (UUID)                │    │  Every incident write        │
│  ├─ type                      │    │  triggers immediate update   │
│  ├─ severity                  │    │  in web dashboard            │
│  ├─ latitude                  │    │                              │
│  ├─ longitude                 │    │  Uses onSnapshot listener    │
│  ├─ timestamp                 │    │  for real-time sync         │
│  ├─ status                    │    │                              │
│  ├─ user_id                   │    │  Zero latency               │
│  ├─ synced_at                 │    │  (< 100ms updates)          │
│  └─ created_at                │    │                              │
│                               │    │                              │
│  Indexes:                     │    │                              │
│  ├─ status (for queries)      │    │                              │
│  ├─ user_id (for filtering)   │    │                              │
│  ├─ location (geospatial)     │    │                              │
│  └─ created_at (time range)   │    │                              │
└──────────────────────────────┘    └──────────────────────────────┘
        ↑                                      ↑
        └──────────────────────────────────────┘
                      ↓
        ┌─────────────────────────────┐
        │  WEB ADMIN DASHBOARD        │
        │  ┌─────────────────────────┐│
        │  │ React + Firestore SDK   ││
        │  │ - Real-time incident    ││
        │  │   list display          ││
        │  │ - Map visualization     ││
        │  │ - Filter by type/status ││
        │  │ - Analytics & reports   ││
        │  │ - User management       ││
        │  └─────────────────────────┘│
        └─────────────────────────────┘
```

---

## 5. Alternative: PostgreSQL + Supabase (For Maximum Control)

If you prefer traditional relational database with more control:

```
Mobile App (SQLite)
    ↓
Backend API
    ↓
Supabase (PostgreSQL + Real-time)
    ↓
Web Admin Dashboard
```

**Benefits:**

- Full SQL query power
- Custom business logic possible
- Can run own copy of data (self-host option)
- Better for complex reporting needs

**Challenges:**

- Requires more backend code
- Need to implement real-time updates manually
- More DevOps complexity

---

## 6. Implementation Timeline

### Phase 1: MVP (Week 1-2) - Firebase Firestore

```
├── Setup Firebase project
├── Create Firestore collection schema
├── Implement backend API endpoint (/api/sync)
├── Test sync flow with mobile app
├── Deploy backend to Cloud Run or Heroku
└── Verify incidents appear in Firestore Console
```

### Phase 2: Web Admin Dashboard (Week 3-4)

```
├── Create React web app
├── Setup Firebase authentication
├── Implement incident list view
├── Add real-time listener (onSnapshot)
├── Create map visualization
├── Add filters and search
└── Deploy to Firebase Hosting (free)
```

### Phase 3: Production (Week 5-6)

```
├── Setup Firestore security rules
├── Configure backup & restore
├── Add monitoring & alerts
├── Performance optimization
├── User acceptance testing
└── Production deployment
```

---

## 7. Security Considerations

### Authentication & Authorization

**Mobile App:**

```typescript
// Backend validates token from mobile
POST /api/sync
Authorization: Bearer <JWT_TOKEN>
{
  incidents: [...]
}
```

**Web Dashboard:**

```typescript
// Firebase Authentication
- Email/Password login
- Role-based access control (Firestore Security Rules)
- Only admins can access dashboard
```

### Firestore Security Rules

```typescript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Only admin users can read incidents
    match /incidents/{incident} {
      allow read: if request.auth.token.role == 'admin';
      allow write: if request.auth.token.role == 'admin' ||
                      request.auth.uid == resource.data.user_id;
    }

    // Backend service account can write incidents
    match /incidents/{incident} {
      allow write: if request.auth.uid in getAllowedServiceAccounts();
    }
  }
}
```

---

## 8. Cost Projection (12 Months)

### Firebase Firestore - Startup Scenario

```
Month 1-3 (Testing):
  Reads: ~50,000/month = $3
  Writes: ~10,000/month = $1.80
  Storage: 5 GB = $0.50
  Total: ~$5/month × 3 = $15

Month 4-6 (Pilot):
  Reads: 200,000/month = $12
  Writes: 50,000/month = $9
  Storage: 20 GB = $2
  Total: ~$23/month × 3 = $69

Month 7-12 (Scale):
  Reads: 500,000/month = $30
  Writes: 100,000/month = $18
  Storage: 50 GB = $5
  Total: ~$53/month × 6 = $318

TOTAL YEAR 1: $402
```

### Comparison: PostgreSQL (RDS)

```
RDS db.t3.small: $32/month × 12 = $384
Storage (50 GB): $5/month × 12 = $60
Backups: $5/month × 12 = $60
Backend server (EC2): $10/month × 12 = $120

TOTAL YEAR 1: $624 (+ DevOps effort)
```

**Firestore is 35% cheaper and requires no DevOps!**

---

## 9. Migration Path: SQLite → Firestore

### Step 1: Backend API Change

```typescript
// BEFORE: Write to PostgreSQL
app.post("/api/sync", async (req, res) => {
  const incidents = req.body.incidents;
  await db.query("INSERT INTO incidents ...");
});

// AFTER: Write to Firestore
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const db = getFirestore();

app.post("/api/sync", async (req, res) => {
  const incidents = req.body.incidents;

  // Write to Firestore
  const batch = db.batch();
  incidents.forEach((incident) => {
    const ref = db.collection("incidents").doc(incident.id);
    batch.set(ref, {
      ...incident,
      synced_at: new Date(),
      status: "synced",
    });
  });
  await batch.commit();

  res.json({ synced: incidents.length });
});
```

### Step 2: Web Dashboard

```typescript
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";

const firebaseConfig = {
  /* your config */
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Real-time incident listener
const incidentQuery = query(
  collection(db, "incidents"),
  where("status", "==", "synced")
);

onSnapshot(incidentQuery, (snapshot) => {
  const incidents = snapshot.docs.map((doc) => doc.data());
  // Update UI with new incidents
});
```

---

## 10. Final Recommendation Summary

| Aspect                  | Recommendation                                                  |
| ----------------------- | --------------------------------------------------------------- |
| **Database**            | Firebase Firestore                                              |
| **Authentication**      | Firebase Auth + JWT for mobile                                  |
| **Web Dashboard**       | React + Firestore SDK                                           |
| **Backend API**         | Node.js + Express + Firebase Admin SDK                          |
| **Real-time Updates**   | Firestore onSnapshot listeners                                  |
| **Geolocation Queries** | Firestore geohash indexing                                      |
| **Hosting**             | Firebase Hosting (free for dashboard) + Cloud Run (backend API) |
| **Cost**                | ~$400-600/year for typical scale                                |
| **Effort**              | 4-6 weeks to production                                         |

---

## Next Steps

1. **Create Firebase Project:** https://console.firebase.google.com
2. **Set up Firestore database** with incidents collection
3. **Update backend API** to write to Firestore
4. **Create web admin dashboard** with React
5. **Deploy backend** to Cloud Run or Heroku
6. **Test sync flow** end-to-end
7. **Configure security rules** for production

---

**Questions?** Review the implementation details below or reach out for deployment guidance.
