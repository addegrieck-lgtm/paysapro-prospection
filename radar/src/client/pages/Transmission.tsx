import { useFilters } from '../components/Filters';
import { Notice, PageHeader, Tabs } from '../components/ui';
import { CompanyList } from './Companies';

export default function Transmission() {
  const f = useFilters();
  const tab = (f.values.onglet as 'signaux' | 'pistes') ?? 'signaux';
  return (
    <div className="fade-in">
      <PageHeader title="Transmissions potentielles" subtitle="Signaux publics vérifiables et pistes de prospection. Rien ici n'affirme qu'un dirigeant souhaite vendre." />
      <Tabs
        value={tab}
        onChange={(onglet) => f.set({ onglet, opportunityTypes: undefined, sort: undefined })}
        items={[
          { id: 'signaux', label: 'Signaux de transmission' },
          { id: 'pistes', label: 'Pistes de prospection (opportunités cachées)' },
        ]}
      />
      {tab === 'signaux' ? (
        <>
          <Notice>
            Chaque signal s'appuie sur une preuve publique conservée (extrait + lien) : annonce de recherche de repreneur ou de départ publiée par l'entreprise, cession de fonds publiée au BODACC, fermeture d'établissements… L'<strong>indice de transmission</strong> (0 à 100) additionne ces signaux ; il ne déduit jamais l'âge, la santé, la situation familiale ou les intentions d'un dirigeant.
          </Notice>
          <div className="mt-4">
            <CompanyList preset={{ opportunityTypes: 'transmission', sort: f.values.sort ?? 'transmission' }} hide={['opportunityTypes']} />
          </div>
        </>
      ) : (
        <>
          <Notice tone="warn">
            Pistes de prospection : entreprises <strong>non déclarées à vendre</strong> dont les caractéristiques publiques (ancienneté ≥ 15 ans, taille reprenable, secteur prioritaire, rentabilité publiée, établissements multiples…) justifient une étude. Toute prise de contact relève de votre décision ; l'outil n'envoie jamais de message.
          </Notice>
          <div className="mt-4">
            <CompanyList preset={{ opportunityTypes: 'cachee' }} hide={['opportunityTypes']} />
          </div>
        </>
      )}
    </div>
  );
}
