import { Document, Page, Text, View, Image, StyleSheet } from '@react-pdf/renderer';
import { getConstanciaContent } from '../utils/constanciaText';
import logoUnacar from '../assets/logo-unacar.png';
import logoFci from '../assets/logo-fci.png';

const styles = StyleSheet.create({
  page: {
    paddingTop: 50,
    paddingBottom: 96,
    paddingHorizontal: 68,
    fontSize: 11.5,
    fontFamily: 'Times-Roman',
    lineHeight: 1.5,
    color: '#111111',
  },
  letterhead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 22,
  },
  logo: {
    width: 58,
    height: 58,
    objectFit: 'contain',
  },
  letterheadText: {
    flex: 1,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  uni: {
    textAlign: 'center',
    fontSize: 13,
    fontFamily: 'Times-Bold',
  },
  fac: {
    textAlign: 'center',
    fontSize: 12,
  },
  folio: {
    textAlign: 'right',
    fontSize: 10.5,
    marginBottom: 20,
  },
  addr: {
    marginBottom: 14,
  },
  paragraph: {
    marginBottom: 14,
    textAlign: 'justify',
  },
  closing: {
    textAlign: 'center',
    marginTop: 28,
  },
  signWrap: {
    marginTop: 64,
    alignItems: 'center',
  },
  signRule: {
    borderTopWidth: 1,
    borderTopColor: '#111111',
    width: 280,
    marginBottom: 6,
  },
  signName: {
    fontFamily: 'Times-Bold',
    textAlign: 'center',
  },
  signRole: {
    textAlign: 'center',
    fontSize: 10,
    maxWidth: 320,
  },
  signEmail: {
    textAlign: 'center',
    fontSize: 9.5,
    marginTop: 3,
    color: '#44474e',
  },
  ccp: {
    marginTop: 24,
    fontSize: 9,
    lineHeight: 1.3,
  },
  bold: {
    fontFamily: 'Times-Bold',
  },
});

/** Runs de utils/constanciaText.js como <Text> anidados (equivalente a spans en línea). */
function Runs({ runs }) {
  return runs.map((run, i) => (
    <Text key={i} style={run.bold ? styles.bold : undefined}>
      {'value' in run ? run.value || run.placeholder : run.text}
    </Text>
  ));
}

/**
 * PDF real de una constancia, con el mismo texto que la vista previa en
 * pantalla (ambos leen utils/constanciaText.js) para que nunca queden
 * desalineados.
 */
export default function ConstanciaPdfDocument({ tipo, data, folio }) {
  const { addressLines, paragraphs, cierre, firma, ccp } = getConstanciaContent(tipo, data);

  return (
    <Document title={`Constancia FCI-${folio}`} author="Facultad de Ciencias de la Información — UNACAR">
      <Page size="LETTER" style={styles.page}>
        <View style={styles.letterhead}>
          <Image src={logoUnacar} style={styles.logo} />
          <View style={styles.letterheadText}>
            <Text style={styles.uni}>Universidad Autónoma del Carmen</Text>
            <Text style={styles.fac}>Facultad de Ciencias de la Información</Text>
          </View>
          <Image src={logoFci} style={styles.logo} />
        </View>

        <Text style={styles.folio}>Constancia - FCI-{folio}</Text>

        <Text style={styles.addr}>{addressLines.join('\n')}</Text>

        {paragraphs.map((runs, i) => (
          <Text key={i} style={styles.paragraph}>
            <Runs runs={runs} />
          </Text>
        ))}

        <Text style={styles.closing}>{cierre}</Text>
        <Text style={styles.closing}>&ldquo;Por la Grandeza de México&rdquo;</Text>

        <View style={styles.signWrap}>
          <View style={styles.signRule} />
          <Text style={styles.signName}>{firma.nombre}</Text>
          {firma.cargo && <Text style={styles.signRole}>{firma.cargo}</Text>}
          {firma.email && <Text style={styles.signEmail}>{firma.email}</Text>}
        </View>

        {ccp.length > 0 && <Text style={styles.ccp}>{ccp.join('\n')}</Text>}
      </Page>
    </Document>
  );
}
