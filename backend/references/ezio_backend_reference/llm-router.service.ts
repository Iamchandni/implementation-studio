import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { OpenAiProvider } from './openai.provider';
import { AnthropicProvider } from './anthropic.provider';
import type { LlmProvider } from './llm-provider.interface';
import { providerForModel } from './llm-provider.interface';

@Injectable()
export class LlmRouter {
  private readonly logger = new Logger(LlmRouter.name);

  constructor(
    private readonly openai: OpenAiProvider,
    private readonly anthropic: AnthropicProvider,
  ) {}

  forModel(model: string): LlmProvider {
    const providerName = providerForModel(model);
    if (providerName === 'openai') return this.openai;
    if (providerName === 'anthropic') return this.anthropic;
    throw new BadRequestException(`Unsupported model: ${model}`);
  }
}
