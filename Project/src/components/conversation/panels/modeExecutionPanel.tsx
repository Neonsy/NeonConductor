import { useEffect, useState } from 'react';

import { Button } from '@/web/components/ui/button';

import type { EntityId, TopLevelTab } from '@/app/backend/runtime/contracts';

interface PlanQuestionView {
    id: string;
    question: string;
    answer?: string;
}

interface PlanItemView {
    id: EntityId<'step'>;
    sequence: number;
    description: string;
    status: 'pending' | 'running' | 'completed' | 'failed' | 'aborted';
}

interface PlanView {
    id: EntityId<'plan'>;
    status: 'awaiting_answers' | 'draft' | 'approved' | 'implementing' | 'implemented' | 'failed' | 'cancelled';
    summaryMarkdown: string;
    questions: PlanQuestionView[];
    items: PlanItemView[];
}

interface OrchestratorView {
    run: {
        id: EntityId<'orch'>;
        status: 'running' | 'completed' | 'aborted' | 'failed';
        activeStepIndex?: number;
    };
    steps: Array<{
        id: EntityId<'step'>;
        sequence: number;
        description: string;
        status: 'pending' | 'running' | 'completed' | 'failed' | 'aborted';
    }>;
}

export interface ModeExecutionPanelProps {
    topLevelTab: TopLevelTab;
    modeKey: string;
    activePlan?: PlanView;
    isLoadingPlan: boolean;
    orchestratorView?: OrchestratorView;
    isPlanMutating: boolean;
    isOrchestratorMutating: boolean;
    onAnswerQuestion: (planId: EntityId<'plan'>, questionId: string, answer: string) => void;
    onRevisePlan: (planId: EntityId<'plan'>, summaryMarkdown: string, items: string[]) => void;
    onApprovePlan: (planId: EntityId<'plan'>) => void;
    onImplementPlan: (planId: EntityId<'plan'>) => void;
    onAbortOrchestrator: (orchestratorRunId: EntityId<'orch'>) => void;
}

export function ModeExecutionPanel({
    topLevelTab,
    modeKey,
    activePlan,
    isLoadingPlan,
    orchestratorView,
    isPlanMutating,
    isOrchestratorMutating,
    onAnswerQuestion,
    onRevisePlan,
    onApprovePlan,
    onImplementPlan,
    onAbortOrchestrator,
}: ModeExecutionPanelProps) {
    const [summaryDraft, setSummaryDraft] = useState('');
    const [itemsDraft, setItemsDraft] = useState('');
    const [answerByQuestionId, setAnswerByQuestionId] = useState<Record<string, string>>({});

    useEffect(() => {
        if (!activePlan) {
            setSummaryDraft('');
            setItemsDraft('');
            setAnswerByQuestionId({});
            return;
        }

        setSummaryDraft(activePlan.summaryMarkdown);
        setItemsDraft(activePlan.items.map((item) => item.description).join('\n'));
        setAnswerByQuestionId(
            Object.fromEntries(activePlan.questions.map((question) => [question.id, question.answer ?? '']))
        );
    }, [activePlan]);

    if (modeKey !== 'plan' && topLevelTab !== 'orchestrator') {
        return null;
    }

    return (
        <section className='border-border bg-card mb-3 rounded-md border p-3'>
            {modeKey === 'plan' ? (
                <div className='space-y-3'>
                    <div>
                        <p className='text-sm font-semibold'>Plan Mode</p>
                        <p className='text-muted-foreground text-xs'>
                            Clarify, revise, approve, then implement explicitly.
                        </p>
                    </div>

                    {isLoadingPlan ? (
                        <p className='text-muted-foreground text-xs'>Loading active plan...</p>
                    ) : activePlan ? (
                        <div className='space-y-3'>
                            <p className='text-xs'>
                                Status: <span className='font-medium'>{activePlan.status}</span>
                            </p>
                            {activePlan.questions.map((question) => (
                                <div key={question.id} className='space-y-1'>
                                    <p className='text-xs font-medium'>{question.question}</p>
                                    <div className='flex gap-2'>
                                        <input
                                            className='border-border bg-background h-8 flex-1 rounded-md border px-2 text-xs'
                                            value={answerByQuestionId[question.id] ?? ''}
                                            onChange={(event) => {
                                                const next = event.target.value;
                                                setAnswerByQuestionId((current) => ({
                                                    ...current,
                                                    [question.id]: next,
                                                }));
                                            }}
                                        />
                                        <Button
                                            type='button'
                                            size='sm'
                                            variant='outline'
                                            disabled={
                                                isPlanMutating ||
                                                (answerByQuestionId[question.id] ?? '').trim().length === 0
                                            }
                                            onClick={() => {
                                                const answer = (answerByQuestionId[question.id] ?? '').trim();
                                                if (!answer) {
                                                    return;
                                                }
                                                onAnswerQuestion(activePlan.id, question.id, answer);
                                            }}>
                                            Save Answer
                                        </Button>
                                    </div>
                                </div>
                            ))}

                            <div className='space-y-1'>
                                <p className='text-xs font-medium'>Plan Summary</p>
                                <textarea
                                    rows={4}
                                    className='border-border bg-background w-full rounded-md border p-2 text-xs'
                                    value={summaryDraft}
                                    onChange={(event) => {
                                        setSummaryDraft(event.target.value);
                                    }}
                                />
                            </div>
                            <div className='space-y-1'>
                                <p className='text-xs font-medium'>Plan Items (one per line)</p>
                                <textarea
                                    rows={4}
                                    className='border-border bg-background w-full rounded-md border p-2 text-xs'
                                    value={itemsDraft}
                                    onChange={(event) => {
                                        setItemsDraft(event.target.value);
                                    }}
                                />
                            </div>

                            <div className='flex flex-wrap gap-2'>
                                <Button
                                    type='button'
                                    size='sm'
                                    variant='outline'
                                    disabled={isPlanMutating}
                                    onClick={() => {
                                        const items = itemsDraft
                                            .split('\n')
                                            .map((item) => item.trim())
                                            .filter((item) => item.length > 0);
                                        onRevisePlan(activePlan.id, summaryDraft.trim(), items);
                                    }}>
                                    Save Draft
                                </Button>
                                <Button
                                    type='button'
                                    size='sm'
                                    variant='outline'
                                    disabled={isPlanMutating || activePlan.status === 'approved'}
                                    onClick={() => {
                                        onApprovePlan(activePlan.id);
                                    }}>
                                    Approve
                                </Button>
                                <Button
                                    type='button'
                                    size='sm'
                                    disabled={
                                        isPlanMutating ||
                                        (activePlan.status !== 'approved' && activePlan.status !== 'implementing')
                                    }
                                    onClick={() => {
                                        onImplementPlan(activePlan.id);
                                    }}>
                                    Implement
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <p className='text-muted-foreground text-xs'>
                            Submit a planning prompt to create a plan for this session.
                        </p>
                    )}
                </div>
            ) : null}

            {topLevelTab === 'orchestrator' && orchestratorView ? (
                <div className='mt-3 space-y-2'>
                    <div className='flex items-center justify-between'>
                        <p className='text-sm font-semibold'>Orchestrator Run</p>
                        <Button
                            type='button'
                            size='sm'
                            variant='outline'
                            disabled={isOrchestratorMutating || orchestratorView.run.status !== 'running'}
                            onClick={() => {
                                onAbortOrchestrator(orchestratorView.run.id);
                            }}>
                            Abort
                        </Button>
                    </div>
                    <p className='text-xs'>
                        Status: <span className='font-medium'>{orchestratorView.run.status}</span>
                    </p>
                    <div className='space-y-1'>
                        {orchestratorView.steps.map((step) => (
                            <div key={step.id} className='bg-background rounded border px-2 py-1 text-xs'>
                                {String(step.sequence)}. {step.description} - {step.status}
                            </div>
                        ))}
                    </div>
                </div>
            ) : null}
        </section>
    );
}
