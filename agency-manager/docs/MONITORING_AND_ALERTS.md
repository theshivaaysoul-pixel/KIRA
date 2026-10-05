# KIRA Agency Manager — Monitoring, Logging & Alerting Architecture

This document defines the production observability stack, Cloud Logging filters, Cloud Monitoring metrics, alerting thresholds, and incident notification pathways.

---

## 1. Structured Logging Standards

All runtime logs emitted by Next.js / Cloud Run adhere to structured JSON standards.

### Log Entry Schema
```json
{
  "severity": "INFO | WARNING | ERROR | CRITICAL",
  "message": "Human-readable description of event",
  "service": "kira-agency-manager-prod",
  "requestId": "req_84920210-91ab-4122-8321",
  "path": "/api/content",
  "method": "POST",
  "statusCode": 201,
  "durationMs": 42,
  "userId": "usr_safe_uuid_only",
  "timestamp": "2026-10-01T04:20:00Z"
}
```

### Strict Redaction & Masking Rules
The logger strictly suppresses sensitive data. The following MUST NEVER appear in log messages or metadata:
- ❌ Passwords or PINs
- ❌ OAuth access tokens or refresh tokens
- ❌ Session secrets or authentication cookies (`session`, `__session`)
- ❌ Private keys or PEM headers
- ❌ Service account credentials JSON
- ❌ Raw API keys

---

## 2. Cloud Monitoring Metrics & SLOs

| Metric | Target SLO | Cloud Monitoring Metric Identifier |
|---|---|---|
| **Service Availability** | 99.9% | `run.googleapis.com/request_count` (Filtered by `response_code_class != '5xx'`) |
| **API Latency (p95)** | < 1,200 ms | `run.googleapis.com/request_latencies` (95th percentile) |
| **Memory Utilization** | < 80% | `run.googleapis.com/container/memory/utilizations` |
| **CPU Utilization** | < 75% | `run.googleapis.com/container/cpu/utilizations` |
| **Storage Error Rate** | 0% | Custom metric: `logging.googleapis.com/user/storage_operation_failures` |

---

## 3. Production Alert Policies

Google Cloud Monitoring alert policies configured for immediate SRE notification:

### 1. High Error Rate Alert (P1 - Critical)
- **Condition**: Ratio of HTTP 5xx responses to total requests exceeds **1%** over a 5-minute rolling window.
- **Notification**: PagerDuty / On-call Slack webhook.
- **Action**: Check Cloud Run revision logs, investigate GCS connectivity or external provider downtime.

### 2. High Request Latency Alert (P2 - Warning)
- **Condition**: 95th percentile response latency exceeds **2,500 ms** for > 5 consecutive minutes.
- **Notification**: Slack `#kira-alerts` channel.
- **Action**: Check Cloud Run instance count, inspect GCS read-back throughput, evaluate autoscaling concurrency.

### 3. GCS Storage Operation Failures (P1 - Critical)
- **Log Filter**:
  ```text
  resource.type="cloud_run_revision"
  resource.labels.service_name="kira-agency-manager-prod"
  jsonPayload.message=~".*GCS.*failed.*" OR jsonPayload.error=~".*storage.*"
  ```
- **Threshold**: > 2 events in 5 minutes.
- **Action**: Verify GCS IAM permissions, inspect bucket status, check quota limits.

### 4. Background Publishing Engine Failures (P2 - Warning)
- **Log Filter**:
  ```text
  resource.type="cloud_run_revision"
  jsonPayload.service="publishing-worker"
  jsonPayload.status="DEAD_LETTER"
  ```
- **Threshold**: > 0 events.
- **Action**: Review platform adapter error, verify platform rate limit status.

---

## 4. Operational Dashboard

The Google Cloud Console monitoring dashboard integrates:
1. **Traffic & Request Rate**: Requests per second broken down by response code (2xx, 3xx, 4xx, 5xx).
2. **Container Instances**: Active, idle, and autoscaled instance counts.
3. **Storage Health**: Time series of `/api/health/storage` diagnostic checks.
4. **Data Health Status**: Count of verified vs invalid entity references reported by `/api/admin/data-health`.
