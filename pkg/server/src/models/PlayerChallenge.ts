import services from '../services';
import CacheService from '../services/cache';
import DatabaseService from '../services/database';
import { now } from '../util/helpers';
import ChallengeDAO, {
  Attachment, Challenge, ChallengeSolve, Hint,
} from './Challenge';
import { UnixTimestamp } from './Common';

export type PlayerChallenge = Omit<Challenge, 'created_at' | 'display_at'> & { display_at: UnixTimestamp };
export type PlayerHint = Omit<Hint, 'created_at'> & { released_at: UnixTimestamp };
export type PlayerAttachment = Attachment;
export type PlayerChallengeSolve = Omit<ChallengeSolve, 'flag_id' | 'submission'>;

/**
 * Provides a interface for players to view challenges.
 *
 * This should enforce rules such as `display_at` based masking.
 */
export class PlayerChallengeDAO {
  constructor(
    private challengeDAO: typeof ChallengeDAO,
    private database: DatabaseService,
    private cache: CacheService,
  ) {}

  public async listVisibleChallenges(): Promise<PlayerChallenge[]> {
    return (await this.challengeDAO.listChallenges())
      .map((chal) => this.filterChallenge(chal))
      .filter((x): x is PlayerChallenge => x !== null);
  }

  public async getChallengeById(id: number): Promise<PlayerChallenge | null> {
    const chal = await this.challengeDAO.getChallengeById(id);
    return chal ? this.filterChallenge(chal) : null;
  }

  public async getChallengeSolves(id: number): Promise<PlayerChallengeSolve[]> {
    const solves = await this.challengeDAO.getChallengeSolves(id);
    return solves.map((solve) => ({
      submitter: solve.submitter,
      submitted_at: solve.submitted_at,
      challenge_id: id,
    }));
  }

  public async makeAndCheckSubmission(
    userId: number,
    challengeId: number,
    submission: string,
  ): Promise<boolean> {
    await this.challengeDAO.makeSubmission(userId, challengeId, submission);
    return this.challengeDAO.checkSubmission(challengeId, submission);
  }

  public async listChallengeHints(challengeId: number): Promise<PlayerHint[]> {
    return (await this.challengeDAO.getChallengeHints(challengeId))
      .map((hint) => this.filterHint(hint))
      .filter((x): x is PlayerHint => x !== null);
  }

  public async getHint(hintId: number): Promise<PlayerHint | null> {
    const hint = await this.challengeDAO.getHintById(hintId);
    return hint ? this.filterHint(hint) : null;
  }

  private filterHint = (rawHint: Hint): PlayerHint | null => {
    if (rawHint.released_at === null || rawHint.released_at > now()) { return null; }
    const { created_at, ...hint } = rawHint;
    return hint as PlayerHint;
  };

  private filterChallenge = (rawChal: Challenge): PlayerChallenge | null => {
    if (rawChal.display_at === null || rawChal.display_at > now()) { return null; }
    const { created_at, ...chal } = rawChal;
    return chal as PlayerChallenge;
  };
}

export default new PlayerChallengeDAO(ChallengeDAO, services.database, services.cache);
