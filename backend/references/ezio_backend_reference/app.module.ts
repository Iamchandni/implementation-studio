import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './common/prisma/prisma.module';
import { SecretsModule } from './common/secrets/secrets.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { RbacModule } from './rbac/rbac.module';
import { AgentsModule } from './agents/agents.module';
import { WorkflowModule } from './workflow/workflow.module';
import { ExecutionModule } from './execution/execution.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { McpModule } from './mcp/mcp.module';
import { GatewayModule } from './gateway/gateway.module';
import { PolicyModule } from './policy/policy.module';
import { ApprovalModule } from './approval/approval.module';
import { AuditModule } from './audit/audit.module';
import { EnvironmentsModule } from './environments/environments.module';
import { LlmModule } from './llm/llm.module';
import { PromptsModule } from './prompts/prompts.module';
import { ApiKeysModule } from './api-keys/api-keys.module';
import { AlertsModule } from './alerts/alerts.module';
import { MarketplaceModule } from './marketplace/marketplace.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // 100 req/min per IP globally; stricter throttles applied per-route with @Throttle.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    PrismaModule,
    SecretsModule,
    AuthModule,
    UsersModule,
    OrganizationsModule,
    RbacModule,
    LlmModule,
    AgentsModule,
    WorkflowModule,
    ExecutionModule,
    IntegrationsModule,
    McpModule,
    GatewayModule,
    PolicyModule,
    ApprovalModule,
    AuditModule,
    EnvironmentsModule,
    PromptsModule,
    ApiKeysModule,
    AlertsModule,
    MarketplaceModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
