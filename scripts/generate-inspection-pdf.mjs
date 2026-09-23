import PDFDocument from "pdfkit";
import { createWriteStream } from "node:fs";

const target = process.argv[2];
let raw = "";
for await (const chunk of process.stdin) raw += chunk;
const { project, inspectorName, data } = JSON.parse(raw);
const doc = new PDFDocument({ size: "A4", margin: 46, info: { Title: "Vistoria do imóvel", Author: "ArremataFlow" } });
doc.pipe(createWriteStream(target));
const heading = (title) => { doc.moveDown(.7).font("Helvetica-Bold").fontSize(14).fillColor("#0F3D56").text(title).moveDown(.35).fillColor("#1F2937"); };
const line = (label, value) => doc.font("Helvetica-Bold").fontSize(9).text(`${label}: `, { continued: true }).font("Helvetica").text(String(value ?? "-") || "-");
const yn = (value) => value ? "Sim" : "Não";
doc.font("Helvetica-Bold").fontSize(21).fillColor("#0F3D56").text("ARREMATAFLOW", { align: "center" });
doc.moveDown(.25).fontSize(17).fillColor("#111827").text("Laudo de Vistoria de Imóvel", { align: "center" });
doc.font("Helvetica").fontSize(10).text(project.name, { align: "center" }).text(`${project.address} - ${project.city}`, { align: "center" });
heading("1. Dados do Imóvel"); line("Tipo de vistoria", data.inspectionType === "venda" ? "Venda" : "Posse"); line("Data e hora", data.dateTime ? new Date(data.dateTime).toLocaleString("pt-BR") : "-"); line("Tipo de imóvel", data.propertyType); line("Vistoriador", inspectorName); line("Contato", data.inspectorPhone); line("Oficial de Justiça", yn(data.bailiffPresent)); if (data.bailiffPresent) { line("Nome do Oficial", data.bailiffName); line("Fone do Oficial", data.bailiffPhone); }
heading("2. Chaves e Acessos"); for (const [key,label] of Object.entries({ chaves: "Chaves", controle: "Controle remoto", tags: "Tags/cartões" })) { const item=data.keys?.[key]; line(label,item?.has?`Sim - Quantidade: ${item.quantity}`:"Não"); } line("Outros",data.otherAccess);
heading("3. Serviços Públicos"); line("Energia",yn(data.utilities?.energy)); line("Medidor de energia",data.utilities?.energyMeter); line("Concessionária de luz",data.utilities?.energyCompany); line("Água",yn(data.utilities?.water)); line("Medidor de água",data.utilities?.waterMeter); line("Concessionária de água",data.utilities?.waterCompany); line("Esgoto tratado",yn(data.utilities?.sewer)); line("Concessionária de esgoto",data.utilities?.sewerCompany);
heading("4. Condições por Cômodo"); (data.rooms||[]).forEach((room,index)=>{doc.font("Helvetica-Bold").fontSize(11).text(`${index+1}. ${room.name||"Cômodo"}`);for(const [key,value] of Object.entries(room.conditions||{}))line(key,value);line("Mobília",room.furniture);line("Observações",room.notes);doc.moveDown(.35);});
heading("5. Instalações Elétricas e Hidráulicas"); line("Quadro de luz e disjuntores",yn(data.installations?.electricalPanel));line("Vazamentos",data.installations?.leaks?`Sim - ${data.installations.leakLocation||"Local não informado"}`:"Não");line("Vasos sanitários e descargas",yn(data.installations?.toilets));line("Ralos",data.installations?.drains);line("Caixa d'água",data.installations?.waterTank);
heading("6. Inventário de Móveis e Eletrodomésticos");(data.inventory||[]).forEach((item,index)=>line(`${index+1}. ${item.item||"Item"}`,`${item.model||"-"} | Estado: ${item.condition||"-"}`));
heading("7. Observações Gerais e Ressalvas");doc.font("Helvetica").fontSize(9).text(data.generalNotes||"Nenhuma observação registrada.");
heading("8. Anexos Fotográficos");const photos=data.photos||[];if(!photos.length)doc.font("Helvetica").fontSize(9).text("Nenhuma fotografia anexada.");for(const [index,photo] of photos.entries()){try{const encoded=String(photo.data).split(",")[1];if(!encoded)continue;if(doc.y>610)doc.addPage();doc.font("Helvetica-Bold").fontSize(9).text(`${index+1}. ${photo.name||"Fotografia"}`);doc.image(Buffer.from(encoded,"base64"),{fit:[500,300],align:"center"});doc.moveDown(.5);}catch{doc.font("Helvetica").fontSize(9).text(`Não foi possível inserir a fotografia ${index+1}.`);}}
doc.end();
