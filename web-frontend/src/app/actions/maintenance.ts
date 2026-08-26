'use server';

import { recommendCleaning } from '@/lib/maintenance/cleaning-decision';
import { analyzePR } from '@/lib/maintenance/pr-analysis';
import { analyzeStrings } from '@/lib/maintenance/string-analysis';
import {
    CleaningDecisionInput,
    PRAnaInput,
    StringAnalysisInput,
    CleaningDecision,
    PRAnalysisReport,
    StringAnalysis
} from '@/lib/maintenance/types';

export async function getCleaningDecisionAction(input: CleaningDecisionInput): Promise<CleaningDecision> {
    try {
        return await recommendCleaning(input);
    } catch (error) {
        console.error('Cleaning Decision Error:', error);
        throw new Error('Failed to generate cleaning decision');
    }
}

export async function getPRAnalysisAction(input: PRAnaInput): Promise<PRAnalysisReport> {
    try {
        return await analyzePR(input);
    } catch (error) {
        console.error('PR Analysis Error:', error);
        throw new Error('Failed to analyze PR');
    }
}

export async function getStringAnalysisAction(input: StringAnalysisInput): Promise<StringAnalysis> {
    try {
        return await analyzeStrings(input);
    } catch (error) {
        console.error('String Analysis Error:', error);
        throw new Error('Failed to analyze strings');
    }
}
