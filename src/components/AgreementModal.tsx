import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';

interface AgreementModalProps {
  visible: boolean;
  onClose: () => void;
  url: string;
  title: string;
}

export const AgreementModal: React.FC<AgreementModalProps> = ({
  visible,
  onClose,
  url,
  title,
}) => {
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<boolean>(false);

  const fetchContent = async () => {
    if (!url) return;
    setLoading(true);
    setError(false);
    try {
      const response = await fetch(url);
      const html = await response.text();
      const parsedText = cleanHtmlToText(html);
      setContent(parsedText);
    } catch (e) {
      console.log('Error fetching agreement content:', e);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible) {
      fetchContent();
    } else {
      setContent('');
    }
  }, [visible, url]);

  const cleanHtmlToText = (html: string): string => {
    let mainContent = html;
    
    // Try to isolate the main post/article content to avoid menus/footers
    const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
    if (articleMatch) {
      mainContent = articleMatch[1];
    } else {
      const mainMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
      if (mainMatch) {
        mainContent = mainMatch[1];
      } else {
        const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
        if (bodyMatch) {
          mainContent = bodyMatch[1];
        }
      }
    }

    // Strip scripts and styles
    mainContent = mainContent.replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, '');
    mainContent = mainContent.replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, '');
    
    // Convert basic text tags to formatting/newlines
    mainContent = mainContent.replace(/<\/p>/gi, '\n\n');
    mainContent = mainContent.replace(/<\/div>/gi, '\n');
    mainContent = mainContent.replace(/<br\s*\/?>/gi, '\n');
    mainContent = mainContent.replace(/<\/li>/gi, '\n');
    mainContent = mainContent.replace(/<li[^>]*>/gi, ' • ');
    mainContent = mainContent.replace(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi, '\n\n$1\n\n');

    // Remove all remaining tags
    let text = mainContent.replace(/<[^>]+>/g, '');

    // Decode standard HTML entities
    text = text
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&rsquo;/g, "'")
      .replace(/&ldquo;/g, '"')
      .replace(/&rdquo;/g, '"')
      .replace(/&bull;/g, '•')
      .replace(/&ndash;/g, '-')
      .replace(/&mdash;/g, '—')
      .replace(/&ccedil;/g, 'ç')
      .replace(/&Ccedil;/g, 'Ç')
      .replace(/&ouml;/g, 'ö')
      .replace(/&Ouml;/g, 'Ö')
      .replace(/&uuml;/g, 'ü')
      .replace(/&Uuml;/g, 'Ü');

    // Normalize whitespace and newlines
    text = text.replace(/\n\s+\n/g, '\n\n');
    text = text.replace(/ +/g, ' ');
    text = text.replace(/\n{3,}/g, '\n\n');

    return text.trim();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Content */}
        <View style={styles.contentContainer}>
          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color="#FFD500" />
              <Text style={styles.loadingText}>Yükleniyor...</Text>
            </View>
          ) : error ? (
            <View style={styles.center}>
              <Text style={styles.errorText}>Yazı yüklenirken bir hata oluştu.</Text>
              <TouchableOpacity onPress={fetchContent} style={styles.retryButton}>
                <Text style={styles.retryText}>Tekrar Dene</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={true} contentContainerStyle={styles.scrollContent}>
              <Text style={styles.text}>{content}</Text>
            </ScrollView>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F2F3',
  },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#CFCFCF',
    backgroundColor: '#FFF',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
    flex: 1,
    marginRight: 16,
  },
  closeButton: {
    padding: 4,
  },
  closeText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#000',
  },
  contentContainer: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  text: {
    fontSize: 14,
    lineHeight: 22,
    color: '#333',
    fontWeight: '400',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    color: '#555',
    fontSize: 15,
    fontWeight: '500',
  },
  errorText: {
    fontSize: 16,
    color: '#D32F2F',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#000',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  retryText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '600',
  },
});

export default AgreementModal;
