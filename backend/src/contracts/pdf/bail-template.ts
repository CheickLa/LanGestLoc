export interface ClauseContext {
  lieu: string;
  localName: string;
  rentAmount: string;
  depositAmount: string;
  startDate: string;
  endDate: string | null;
}

export interface BailClause {
  title: string;
  body: string;
}

export function buildBailClauses(ctx: ClauseContext): BailClause[] {
  const duree = ctx.endDate
    ? `Le présent contrat est consenti pour la période courant du ${ctx.startDate} au ${ctx.endDate}. Il pourra être renouvelé par accord exprès des deux parties.`
    : `Le présent contrat prend effet le ${ctx.startDate} pour une durée indéterminée. Il pourra être renouvelé par accord exprès des deux parties.`;

  return [
    {
      title: 'Objet',
      body: `Le bailleur donne en location au locataire le local commercial désigné « ${ctx.localName} », situé à ${ctx.lieu}. Le local est destiné à un usage exclusivement commercial. Le locataire ne peut ni en faire un usage d'habitation, ni en changer la destination sans l'accord écrit du bailleur, sous peine de résiliation.`,
    },
    {
      title: 'Durée',
      body: duree,
    },
    {
      title: 'Loyer',
      body: `Le loyer mensuel est fixé à ${ctx.rentAmount}, payable au plus tard le 5 du mois suivant le mois concerné. Toute révision du loyer fait l'objet d'un nouvel accord et prend effet à la date convenue, sans rétroactivité.`,
    },
    {
      title: 'Dépôt de caution',
      body: `À la signature du présent contrat, le locataire verse un dépôt de caution de ${ctx.depositAmount}, équivalent à un mois de loyer. Cette caution constitue une garantie pure : elle n'est jamais imputée sur un loyer. Elle est restituée au locataire à la fin du contrat, sous réserve du règlement préalable de tout loyer impayé.`,
    },
    {
      title: 'Charges',
      body: `Les frais d'eau et d'électricité afférents au local sont à la charge exclusive du locataire.`,
    },
    {
      title: 'Obligations du locataire',
      body: `Le locataire s'engage à payer le loyer aux échéances convenues, à user paisiblement du local et à le maintenir en bon état d'entretien. Il évite toute dégradation du bâtiment ainsi que tout conflit de voisinage, sous peine de résiliation.`,
    },
    {
      title: 'Obligations du bailleur',
      body: `Le bailleur s'engage à délivrer le local en bon état et à garantir au locataire une jouissance libre et paisible pendant toute la durée du contrat.`,
    },
    {
      title: 'État des lieux',
      body: `Un état des lieux d'entrée est dressé contradictoirement avant la remise des clés. Un état des lieux de sortie est établi à la fin du contrat ; le locataire s'engage à restituer le local dans l'état où il l'a reçu.`,
    },
    {
      title: 'Préavis',
      body: `Le locataire informe le bailleur trois (3) mois à l'avance avant de quitter les lieux. De même, le bailleur informe le locataire trois (3) mois à l'avance avant toute rupture du contrat.`,
    },
    {
      title: 'Résiliation',
      body: `Le contrat peut être résilié dans les conditions prévues par la loi. Tout loyer impayé doit être réglé avant la résiliation. À la résiliation, le dépôt de caution est restitué au locataire.`,
    },
  ];
}
