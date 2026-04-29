import { handleInstallation } from './installation';
   import { handlePullRequest } from './pull-request';
   
   /**
    * Routes a GitHub webhook event to the right handler.
    * Returns a short string describing what happened, for logging.
    */
   export async function routeEvent(
     eventType: string,
     payload: any
   ): Promise<string> {
     switch (eventType) {
       case 'installation':
       case 'installation_repositories':
         return await handleInstallation(payload);
       case 'pull_request':
         return await handlePullRequest(payload);
       default:
         return `ignored:${eventType}`;
     }
   }