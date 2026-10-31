'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Workflow, Plus, Play, Trash2 } from 'lucide-react';
import { formatRelative } from '@/lib/utils';
import { RunWorkflowDialog } from '@/components/run-workflow-dialog';

export default function WorkflowsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['workflows'],
    queryFn: () => api.get<any[]>('/workflows'),
  });
  const [runTarget, setRunTarget] = useState<{ id: string; name: string; environmentId?: string } | null>(null);

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/workflows/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workflows'] }),
  });

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Workflows</h1>
          <p className="text-muted-foreground mt-1">Visual multi-step agent orchestration</p>
        </div>
        <Button asChild>
          <Link href="/workflows/new">
            <Plus className="w-4 h-4" /> New Workflow
          </Link>
        </Button>
      </div>

      {isLoading && <p className="text-muted-foreground">Loading...</p>}

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {(data ?? []).map((w: any) => (
          <Card
            key={w.id}
            className="hover:border-primary/50 transition-colors relative h-full flex flex-col"
          >
            <Link href={`/workflows/${w.id}`} className="block flex-1">
              <CardContent className="p-6 cursor-pointer">
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Workflow className="w-5 h-5 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold truncate">{w.name}</h3>
                      <Badge variant={w.status === 'published' ? 'success' : 'secondary'} className="text-[10px] shrink-0">
                        {w.status}
                      </Badge>
                    </div>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground line-clamp-2">{w.description}</p>
                <div className="flex items-center gap-4 mt-4 pt-4 border-t text-xs text-muted-foreground">
                  <span>v{w.currentVersion}</span>
                  <span>{w.environment?.name}</span>
                  <span>{formatRelative(w.createdAt)}</span>
                </div>
              </CardContent>
            </Link>

            {/* Always-visible action row pinned to the bottom of the card. */}
            <div className="flex items-center justify-end gap-1.5 px-6 pb-4 -mt-2">
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setRunTarget({ id: w.id, name: w.name, environmentId: w.environment?.id });
                }}
                className="h-7 px-2.5 text-[11px] rounded-md bg-green-500 text-white hover:bg-green-500/90 flex items-center gap-1 font-medium"
                title="Run workflow"
              >
                <Play className="w-3 h-3" fill="currentColor" />
                Run
              </button>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (confirm(`Delete workflow "${w.name}"? This deletes all executions too. Cannot be undone.`)) {
                    remove.mutate(w.id);
                  }
                }}
                className="h-7 w-7 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 flex items-center justify-center"
                title="Delete workflow"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </Card>
        ))}
      </div>

      {!isLoading && (data ?? []).length === 0 && (
        <Card>
          <CardContent className="text-center py-16">
            <Workflow className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-semibold mb-1">No workflows yet</h3>
            <p className="text-sm text-muted-foreground mb-4">Design your first workflow visually</p>
            <Button asChild>
              <Link href="/workflows/new">Create Workflow</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {runTarget && (
        <RunWorkflowDialog
          workflowId={runTarget.id}
          workflowName={runTarget.name}
          environmentId={runTarget.environmentId}
          onClose={() => setRunTarget(null)}
        />
      )}
    </div>
  );
}
