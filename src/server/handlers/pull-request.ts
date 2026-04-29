export async function handlePullRequest(payload: any): Promise<string> {
     // TODO: implement in Task 6
     return `pull_request:stub:${payload?.action ?? 'unknown'}`;
   }