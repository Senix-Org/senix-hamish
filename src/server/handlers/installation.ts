import { supabaseAdmin } from '@/lib/supabase';
   
   /**
    * Handles installation and installation_repositories events.
    * Possible actions:
    *  - installation.created      → app installed for the first time
    *  - installation.deleted      → app uninstalled
    *  - installation.suspend      → app suspended
    *  - installation.unsuspend    → app un-suspended
    *  - installation_repositories.added   → user added repos to existing install
    *  - installation_repositories.removed → user removed repos
    */
   export async function handleInstallation(payload: any): Promise<string> {
     const action = payload.action as string;
     const installation = payload.installation;
     const installationId = installation.id as number;
   
     if (!installationId) {
       return 'installation:no-id';
     }
   
     // Handle uninstall
     if (action === 'deleted') {
       await supabaseAdmin
         .from('installations')
         .update({ uninstalled_at: new Date().toISOString() })
         .eq('github_installation_id', installationId);
       return `installation:deleted:${installationId}`;
     }
   
     // Handle suspend / unsuspend
     if (action === 'suspend' || action === 'unsuspend') {
       await supabaseAdmin
         .from('installations')
         .update({ suspended: action === 'suspend' })
         .eq('github_installation_id', installationId);
       return `installation:${action}:${installationId}`;
     }
   
     // Upsert the installation row (created, new_permissions_accepted, etc.).
     // Re-installing the same github_installation_id clears `uninstalled_at`
     // so prior history (repos, PRs, analyses) reactivates instead of being
     // duplicated.
     const account = installation.account;
     const { data: installRow, error: installError } = await supabaseAdmin
       .from('installations')
       .upsert(
         {
           github_installation_id: installationId,
           account_login: account.login,
           account_type: account.type,
           suspended: false,
           uninstalled_at: null,
         },
         { onConflict: 'github_installation_id' }
       )
       .select()
       .single();
   
     if (installError || !installRow) {
       throw new Error(`Failed to upsert installation: ${installError?.message}`);
     }
   
     // For installation events, payload.repositories contains the initial repos
     // For installation_repositories events, use repositories_added / repositories_removed
     const reposAdded =
       payload.repositories ?? payload.repositories_added ?? [];
     const reposRemoved = payload.repositories_removed ?? [];
   
     // Add new repositories
     if (reposAdded.length > 0) {
       const repoRows = reposAdded.map((repo: any) => ({
         installation_id: installRow.id,
         github_repo_id: repo.id,
         full_name: repo.full_name,
         private: repo.private ?? false,
         enabled: true,
       }));
   
       const { error: repoError } = await supabaseAdmin
         .from('repositories')
         .upsert(repoRows, { onConflict: 'github_repo_id' });
   
       if (repoError) {
         throw new Error(`Failed to upsert repos: ${repoError.message}`);
       }
     }
   
     // Remove repositories that were unselected
     if (reposRemoved.length > 0) {
       const removedIds = reposRemoved.map((r: any) => r.id);
       await supabaseAdmin
         .from('repositories')
         .delete()
         .in('github_repo_id', removedIds);
     }
   
     return `installation:${action}:${installationId}:repos+${reposAdded.length}:repos-${reposRemoved.length}`;
   }