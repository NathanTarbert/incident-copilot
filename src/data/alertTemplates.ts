import type { IncidentSeverity } from '../types/incident'

export type AlertScenario = 'security' | 'performance' | 'availability' | 'data'

export interface AlertTemplate {
  scenario: AlertScenario
  title: string
  description: string
  severity: IncidentSeverity
  affectedServices: string[]
  source: string
}

export const alertTemplates: AlertTemplate[] = [
  {
    scenario: 'security',
    title: 'Credential stuffing attack on auth-service',
    description:
      'WAF detected 12,400 failed login attempts in the last 5 minutes from IP range 203.0.113.0/24, targeting the /api/auth/login endpoint. Pattern matches known credential-stuffing toolkit signatures.',
    severity: 'P0',
    affectedServices: ['auth-service', 'api-gateway'],
    source: 'WAF',
  },
  {
    scenario: 'security',
    title: 'Anomalous IAM role assumption from unfamiliar region',
    description:
      'CloudTrail logged a sts:AssumeRole call against the prod-deployer role originating from eu-west-3, a region with no historical activity for this principal. Session token was issued and is currently active.',
    severity: 'P1',
    affectedServices: ['iam', 'prod-deployer'],
    source: 'CloudTrail',
  },
  {
    scenario: 'security',
    title: 'TLS certificate expiring in 24h for api.prod',
    description:
      'Certificate Manager reports the api.prod wildcard certificate expires in 24 hours and the auto-renewal job has failed twice. Manual intervention required before expiry to avoid HTTPS outage.',
    severity: 'P2',
    affectedServices: ['api-gateway', 'cdn-edge'],
    source: 'Certificate Manager',
  },
  {
    scenario: 'performance',
    title: 'API gateway P99 latency spike to 4.2s',
    description:
      'Datadog APM shows P99 latency on api-gateway climbed from baseline 280ms to 4.2s over the last 8 minutes. P50 is unaffected, suggesting a slow path triggered by a subset of requests.',
    severity: 'P1',
    affectedServices: ['api-gateway'],
    source: 'Datadog',
  },
  {
    scenario: 'performance',
    title: 'Redis cache hit rate dropped to 12%',
    description:
      'redis-cache hit rate fell from steady-state 94% to 12% in under 2 minutes. Backend database query volume tripled as a result. No recent deploy correlates.',
    severity: 'P2',
    affectedServices: ['redis-cache', 'postgres-primary'],
    source: 'Datadog',
  },
  {
    scenario: 'availability',
    title: 'postgres-primary connection pool exhausted',
    description:
      'postgres-primary reporting max_connections (200) reached. New application queries timing out with "too many clients" errors. Cascading failures observed in api-gateway and order-service.',
    severity: 'P0',
    affectedServices: ['postgres-primary', 'api-gateway', 'order-service'],
    source: 'CloudWatch',
  },
  {
    scenario: 'availability',
    title: 'Kubernetes node NotReady in production cluster',
    description:
      'Worker node ip-10-0-32-118 transitioned to NotReady. 14 pods evicted, including 3 instances of payment-service. Cluster autoscaler has not yet replaced capacity.',
    severity: 'P1',
    affectedServices: ['payment-service', 'k8s-prod'],
    source: 'Kubernetes',
  },
  {
    scenario: 'availability',
    title: 'CDN edge returning 502 for static assets',
    description:
      'cdn-edge reporting elevated 502 rate (~18%) on static asset requests in us-east region. Origin health check is passing. Suspected edge cache corruption.',
    severity: 'P2',
    affectedServices: ['cdn-edge'],
    source: 'PagerDuty',
  },
  {
    scenario: 'data',
    title: 'Replication lag on read-replica exceeded 30s',
    description:
      'postgres-replica-1 replication lag jumped from <1s to 47s and is climbing. Read traffic routed to this replica is now serving stale data; analytics dashboards showing inconsistent counts.',
    severity: 'P2',
    affectedServices: ['postgres-replica-1'],
    source: 'CloudWatch',
  },
  {
    scenario: 'data',
    title: 'Kafka consumer lag spike on order-events topic',
    description:
      'Consumer group order-processor is lagging 240k messages on the order-events topic. Lag has been growing for 12 minutes. Downstream order fulfillment queue is backing up.',
    severity: 'P1',
    affectedServices: ['kafka-broker', 'order-service'],
    source: 'Datadog',
  },
]

export function pickAlertTemplate(scenario?: AlertScenario): AlertTemplate {
  const pool = scenario
    ? alertTemplates.filter(t => t.scenario === scenario)
    : alertTemplates
  const source = pool.length > 0 ? pool : alertTemplates
  return source[Math.floor(Math.random() * source.length)]
}
