/**
 * Spaced Repetition Engine
 * Implements SM-2 algorithm for review scheduling
 * Pure logic - no database dependency
 */

import { ReviewItem, DEFAULT_SCHEDULER_CONFIG } from './types.js';

/** Quality rating for SM-2 algorithm (0-5) */
export type Quality = 0 | 1 | 2 | 3 | 4 | 5;

/** Review result from a practice session */
export interface ReviewResult {
  atomId: string;
  userId: string;
  isCorrect: boolean;
  confidence: 'easy' | 'medium' | 'hard';
  responseTimeMs: number;
}

/**
 * SpacedRepetition - SM-2 algorithm implementation
 */
export class SpacedRepetition {
  private defaultEaseFactor = 2.5;
  private minEaseFactor = 1.3;

  /**
   * Process a review and calculate next interval
   */
  processReview(item: ReviewItem | null, result: ReviewResult): ReviewItem {
    const quality = this.mapToQuality(result.isCorrect, result.confidence);
    
    if (!item) {
      // First review - create new item
      return this.createInitialReviewItem(result.atomId, result.userId, quality);
    }

    // Calculate new ease factor using SM-2 formula
    // EF' = EF + (0.1 - (5-q) * (0.08 + (5-q) * 0.02))
    const newEaseFactor = Math.max(
      this.minEaseFactor,
      item.easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
    );

    // Calculate new interval
    let newInterval: number;
    let newRepetitions = item.repetitions;

    if (quality < 3) {
      // Failed - reset to beginning
      newInterval = 1;
      newRepetitions = 0;
    } else {
      // Passed - increase interval
      newRepetitions = item.repetitions + 1;
      
      if (newRepetitions === 1) {
        newInterval = 1;
      } else if (newRepetitions === 2) {
        newInterval = 6;
      } else {
        newInterval = Math.round(item.interval * newEaseFactor);
      }
    }

    const now = new Date();
    const dueDate = new Date(now.getTime() + newInterval * 24 * 60 * 60 * 1000);

    return {
      ...item,
      easeFactor: newEaseFactor,
      interval: newInterval,
      repetitions: newRepetitions,
      dueDate,
      lastReviewed: now
    };
  }

  /**
   * Create initial review item for first encounter
   */
  private createInitialReviewItem(
    atomId: string,
    userId: string,
    quality: Quality
  ): ReviewItem {
    const now = new Date();
    let interval = 1;
    let repetitions = 0;

    if (quality >= 3) {
      // Good first attempt
      interval = 1;
      repetitions = 1;
    }

    const dueDate = new Date(now.getTime() + interval * 24 * 60 * 60 * 1000);

    return {
      id: `review-${atomId}-${userId}`,
      userId,
      atomId,
      easeFactor: this.defaultEaseFactor,
      interval,
      repetitions,
      dueDate,
      lastReviewed: now
    };
  }

  /**
   * Map response to SM-2 quality rating
   * 5: perfect, confident, fast
   * 4: correct with hesitation
   * 3: correct but difficult
   * 2: incorrect but close
   * 1: incorrect, some recall
   * 0: complete failure
   */
  mapToQuality(isCorrect: boolean, confidence: 'easy' | 'medium' | 'hard'): Quality {
    if (isCorrect) {
      switch (confidence) {
        case 'easy': return 5;
        case 'medium': return 4;
        case 'hard': return 3;
      }
    } else {
      switch (confidence) {
        case 'easy': return 2; // Should have known it
        case 'medium': return 1;
        case 'hard': return 0;
      }
    }
  }

  /**
   * Get all items due for review
   */
  getItemsDue(items: ReviewItem[], asOf?: Date): ReviewItem[] {
    const now = asOf || new Date();
    return items
      .filter(item => item.dueDate <= now)
      .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  }

  /**
   * Calculate retention score (how well items are retained)
   */
  calculateRetentionScore(items: ReviewItem[]): number {
    if (items.length === 0) return 100;

    const now = new Date();
    let score = 0;

    for (const item of items) {
      if (item.dueDate > now) {
        // Not due yet - full points
        score += 100;
      } else {
        // Overdue - decay based on days overdue
        const daysOverdue = Math.floor(
          (now.getTime() - item.dueDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        score += Math.max(0, 100 - daysOverdue * 10);
      }
    }

    return Math.round(score / items.length);
  }

  /**
   * Predict next review dates
   */
  predictSchedule(items: ReviewItem[], days: number = 7): Map<string, number> {
    const schedule = new Map<string, number>();
    const now = new Date();

    for (let d = 0; d < days; d++) {
      const date = new Date(now.getTime() + d * 24 * 60 * 60 * 1000);
      const dateKey = date.toISOString().split('T')[0];
      
      const dueCount = items.filter(item => {
        const dueDate = item.dueDate.toISOString().split('T')[0];
        return dueDate === dateKey;
      }).length;

      schedule.set(dateKey, dueCount);
    }

    return schedule;
  }
}

/**
 * ReviewQueue - Manages review queue with priorities
 */
export class ReviewQueue {
  private items: ReviewItem[] = [];
  private spaced: SpacedRepetition;

  constructor() {
    this.spaced = new SpacedRepetition();
  }

  /**
   * Load items into queue
   */
  loadItems(items: ReviewItem[]): void {
    this.items = [...items];
  }

  /**
   * Add new item to queue
   */
  addItem(item: ReviewItem): void {
    const existing = this.items.findIndex(i => i.atomId === item.atomId && i.userId === item.userId);
    if (existing >= 0) {
      this.items[existing] = item;
    } else {
      this.items.push(item);
    }
  }

  /**
   * Get next item to review
   */
  getNext(): ReviewItem | null {
    const due = this.spaced.getItemsDue(this.items);
    return due[0] || null;
  }

  /**
   * Get all due items
   */
  getDueItems(): ReviewItem[] {
    return this.spaced.getItemsDue(this.items);
  }

  /**
   * Get count of items due
   */
  getDueCount(): number {
    return this.spaced.getItemsDue(this.items).length;
  }

  /**
   * Process a review result
   */
  processReview(result: ReviewResult): ReviewItem {
    const existing = this.items.find(
      i => i.atomId === result.atomId && i.userId === result.userId
    );
    const updated = this.spaced.processReview(existing || null, result);
    this.addItem(updated);
    return updated;
  }

  /**
   * Get queue stats
   */
  getStats(): { total: number; due: number; upcoming: number; retention: number } {
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    return {
      total: this.items.length,
      due: this.items.filter(i => i.dueDate <= now).length,
      upcoming: this.items.filter(i => i.dueDate > now && i.dueDate <= tomorrow).length,
      retention: this.spaced.calculateRetentionScore(this.items)
    };
  }

  /**
   * Get all items
   */
  getAllItems(): ReviewItem[] {
    return [...this.items];
  }
}
