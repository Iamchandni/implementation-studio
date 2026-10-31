import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { createHash } from 'crypto';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async writeExecutionEvent(data: {
    executionId: string;
    eventType: string;
    nodeId?: string;
    agentId?: string;
    mcpToolId?: string;
    payload?: any;
    inputHash?: string;
    outputHash?: string;
    policyResult?: string;
    tokensUsed?: number;
    latencyMs?: number;
    costUsd?: number;
  }) {
    // Get previous event for hash chain
    const lastEvent = await this.prisma.executionEvent.findFirst({
      where: { executionId: data.executionId },
      orderBy: { timestamp: 'desc' },
    });

    const prevHash = lastEvent
      ? createHash('sha256').update(JSON.stringify(lastEvent)).digest('hex')
      : 'GENESIS';

    return this.prisma.executionEvent.create({
      data: {
        ...data,
        prevHash,
      },
    });
  }

  async verifyChain(executionId: string): Promise<{ valid: boolean; events: number; brokenAt?: number }> {
    const events = await this.prisma.executionEvent.findMany({
      where: { executionId },
      orderBy: { timestamp: 'asc' },
    });

    for (let i = 1; i < events.length; i++) {
      const expectedHash = createHash('sha256')
        .update(JSON.stringify(events[i - 1]))
        .digest('hex');
      if (events[i].prevHash !== expectedHash) {
        return { valid: false, events: events.length, brokenAt: i };
      }
    }

    // Check first event has GENESIS
    if (events.length > 0 && events[0].prevHash !== 'GENESIS') {
      return { valid: false, events: events.length, brokenAt: 0 };
    }

    return { valid: true, events: events.length };
  }

  async writeAuditLog(data: {
    userId?: string;
    organizationId?: string;
    executionId?: string;
    resourceType?: string;
    resourceId?: string;
    action: string;
    metadata?: any;
    ipAddress?: string;
  }) {
    return this.prisma.auditLog.create({ data });
  }
}
