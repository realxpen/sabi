import { communicationResultSchema,providerSchema,quoteSchema,type CommunicationResult,type Mission,type Provider,type Quote } from "../schemas";

export const intelligenceDemoProviders:Provider[]=[
{id:"provider-ade-textiles",name:"Ade Textiles (Demo)",category:"Fabric",location:"Surulere",languages:["English","Pidgin"],verified:true,rating:4.8,completedTransactions:31,reliabilityScore:.94,active:true},
{id:"provider-tola-fabrics",name:"Tola Fabrics (Demo)",category:"Fabric",location:"Yaba",languages:["English","Yoruba"],verified:true,rating:4.5,completedTransactions:18,reliabilityScore:.88,active:true},
{id:"provider-mariam-fabrics",name:"Mariam Fabrics (Demo)",category:"Fabric",location:"Lagos Island",languages:["English","Yoruba"],verified:false,rating:4.2,completedTransactions:9,reliabilityScore:.8,active:true},
{id:"provider-bola-textiles",name:"Bola Textiles (Demo)",category:"Fabric",location:"Yaba",languages:["English"],verified:true,rating:4.7,completedTransactions:27,reliabilityScore:.91,active:true},
{id:"provider-sade-fabrics",name:"Sade Fabrics (Demo)",category:"Fabric",location:"Ikeja",languages:["English","Yoruba"],verified:true,rating:4.9,completedTransactions:42,reliabilityScore:.97,active:true},
{id:"provider-unavailable-textiles",name:"Unavailable Textiles (Demo)",category:"Fabric",location:"Yaba",languages:["English"],verified:true,rating:4.6,completedTransactions:21,reliabilityScore:.9,active:false},
{id:"provider-wrong-category",name:"Ade Plumbing (Demo)",category:"Plumbing",location:"Yaba",languages:["English"],verified:true,rating:4.9,completedTransactions:40,reliabilityScore:.98,active:true}
];

export function buildIntelligenceDemoQuotes(mission:Mission):Quote[]{
 const now=new Date().toISOString();
 return [
  {id:"quote-ade-textiles",missionId:mission.id,providerId:"provider-ade-textiles",available:true,price:60000,deliveryFee:3000,total:63000,deliveryDate:"tomorrow",notes:"Fictional fixture: complete qualifying offer.",source:"MANUAL",sourceReference:"femi-intelligence-fixtures",createdAt:now},
  {id:"quote-tola-fabrics",missionId:mission.id,providerId:"provider-tola-fabrics",available:true,price:64000,deliveryFee:3000,total:67000,deliveryDate:"tomorrow",notes:"Fictional fixture: valid alternative.",source:"MANUAL",sourceReference:"femi-intelligence-fixtures",createdAt:now},
  {id:"quote-mariam-fabrics",missionId:mission.id,providerId:"provider-mariam-fabrics",available:false,notes:"Fictional fixture: requested quantity unavailable.",source:"MANUAL",sourceReference:"femi-intelligence-fixtures",createdAt:now},
  {id:"quote-bola-late",missionId:mission.id,providerId:"provider-bola-textiles",available:true,price:55000,deliveryFee:2000,total:57000,deliveryDate:"in 3 days",notes:"Fictional fixture: cheaper but deadline-invalid.",source:"CALL",sourceReference:"demo-call-bola-late",createdAt:now},
  {id:"quote-sade-over-budget",missionId:mission.id,providerId:"provider-sade-fabrics",available:true,price:76000,deliveryFee:3000,total:79000,deliveryDate:"tomorrow",notes:"Fictional fixture: deadline-valid but over hard budget.",source:"CALL",sourceReference:"demo-call-sade-over-budget",createdAt:now},
  {id:"quote-missing-delivery-fee",missionId:mission.id,providerId:"provider-tola-fabrics",available:true,price:62000,deliveryDate:"tomorrow",notes:"Fictional fixture: delivery fee unknown; total unknown.",source:"CALL",sourceReference:"demo-call-missing-delivery-fee",createdAt:now},
  {id:"quote-unavailable-provider",missionId:mission.id,providerId:"provider-unavailable-textiles",available:false,notes:"Fictional fixture: provider currently unavailable.",source:"OTHER",sourceReference:"demo-provider-unavailable",createdAt:now}
 ].map(q=>quoteSchema.parse(q));
}

export const intelligenceDemoCommunications:CommunicationResult[]=[communicationResultSchema.parse({id:"communication-no-answer",missionId:"canonical-ankara-mission",providerId:"provider-mariam-fabrics",channel:"CALL",status:"NO_ANSWER",summary:"Fictional fixture: provider did not answer.",occurredAt:"2026-10-01T18:00:00.000Z"})];