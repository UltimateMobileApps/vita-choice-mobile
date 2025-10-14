import { Linking, Platform } from 'react-native';
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { apiService, API_BASE_URL } from './api';

export const sanitizeDownloadFileName = (value: string): string => {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .toLowerCase();
};

interface DownloadResult {
  uri?: string;
  fileName: string;
  shared?: boolean;
  opened?: boolean;
  directoryUri?: string;
}

interface DownloadOptions {
  fileName?: string;
  mimeType?: string;
  headers?: Record<string, string>;
  share?: boolean;
  openAfterDownload?: boolean;
}

type DirectoryFactory = () => Directory;

const extractFileName = (url: string): string => {
  try {
    const withoutParams = url.split('?')[0];
    const segments = withoutParams.split('/');
    const lastSegment = segments[segments.length - 1];
    return lastSegment || 'download';
  } catch (error) {
    console.warn('Failed to extract filename from url', error);
    return 'download';
  }
};

const resolveDownloadUrl = (downloadUrl: string): string => {
  if (/^https?:\/\//i.test(downloadUrl)) {
    return downloadUrl;
  }

  const normalized = downloadUrl.startsWith('/') ? downloadUrl : `/${downloadUrl}`;
  const apiRoot = API_BASE_URL.replace(/\/$/, '');
  const baseRoot = apiRoot.replace(/\/api$/, '');

  return `${baseRoot}${normalized}`;
};

const tryGetDirectory = (factory: DirectoryFactory): Directory | null => {
  try {
    const directory = factory();
    return directory?.uri ? directory : null;
  } catch (error) {
    console.warn('FileSystem: unable to resolve directory', error);
    return null;
  }
};

const splitFileName = (fileName: string): { base: string; extension: string } => {
  const trimmed = fileName.trim();
  const lastDot = trimmed.lastIndexOf('.');

  if (lastDot > 0 && lastDot < trimmed.length - 1) {
    const rawExtension = trimmed.slice(lastDot + 1).toLowerCase();
    const isSafeExtension = /^[a-z0-9]+$/i.test(rawExtension);
    return {
      base: trimmed.slice(0, lastDot),
      extension: isSafeExtension ? `.${rawExtension}` : '',
    };
  }

  return { base: trimmed, extension: '' };
};

const ensureDownloadsDirectory = (): Directory => {
  const candidates = [
    tryGetDirectory(() => Paths.document),
    tryGetDirectory(() => Paths.cache),
  ].filter((candidate): candidate is Directory => Boolean(candidate));

  let lastError: unknown;

  for (const candidate of candidates) {
    try {
      const downloadsDirectory = new Directory(candidate, 'downloads');
      if (!downloadsDirectory.exists) {
        downloadsDirectory.create({ intermediates: true, idempotent: true });
      }
      return downloadsDirectory;
    } catch (error) {
      lastError = error;
      console.warn(`FileSystem: unable to prepare downloads directory at ${candidate.uri}`, error);
    }
  }

  const message =
    lastError instanceof Error
      ? `No writable directory available for downloads: ${lastError.message}`
      : 'No writable directory available for downloads';

  throw new Error(message);
};

const buildDownloadTarget = (fileName: string): { file: File; directory: Directory } => {
  const downloadDirectory = ensureDownloadsDirectory();
  const { base, extension } = splitFileName(fileName);
  const safeBase = sanitizeDownloadFileName(base) || 'download';
  const uniqueName = `${Date.now()}-${safeBase}${extension}`;
  return { file: new File(downloadDirectory, uniqueName), directory: downloadDirectory };
};

const tryOpenFile = async (uri: string): Promise<boolean> => {
  try {
    await Linking.openURL(uri);
    return true;
  } catch (error) {
    console.warn('Unable to open downloaded file', error);
    return false;
  }
};

export const downloadFileFromApi = async (
  downloadUrl: string,
  options: DownloadOptions = {}
): Promise<DownloadResult> => {
  if (!downloadUrl) {
    throw new Error('Missing download URL');
  }

  const resolvedUrl = resolveDownloadUrl(downloadUrl);
  const accessToken = await apiService.getAccessToken();
  const headers: Record<string, string> = {
    ...(options.headers ?? {}),
  };

  if (accessToken && !headers.Authorization) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const fileName = options.fileName ?? extractFileName(resolvedUrl);

  if (Platform.OS === 'web') {
    if (typeof globalThis === 'undefined') {
      throw new Error('File download is not supported in this environment');
    }

    const globalScope = globalThis as any;

    if (!globalScope.URL || !globalScope.document) {
      throw new Error('File download is not supported in this environment');
    }

    const response = await fetch(resolvedUrl, { headers });
    if (!response.ok) {
      throw new Error(`Download failed with status ${response.status}`);
    }

    const blob = await response.blob();
    const blobUrl = globalScope.URL.createObjectURL(blob);

    const link = globalScope.document.createElement('a');
    link.href = blobUrl;
    link.download = fileName;
    globalScope.document.body.appendChild(link);
    link.click();
    globalScope.document.body.removeChild(link);
    globalScope.URL.revokeObjectURL(blobUrl);

    return { fileName, uri: blobUrl, shared: false };
  }

  const { file: targetFile, directory } = buildDownloadTarget(fileName);

  try {
    const downloadedFile = await File.downloadFileAsync(resolvedUrl, targetFile, {
      headers,
      idempotent: true,
    });

    let shared = false;

    const shouldShare = options.share !== false;

    if (shouldShare && (await Sharing.isAvailableAsync())) {
      const effectiveMimeType = options.mimeType ?? (downloadedFile.type || undefined);
      await Sharing.shareAsync(downloadedFile.uri, {
        dialogTitle: fileName,
        ...(effectiveMimeType ? { mimeType: effectiveMimeType } : {}),
        ...(options.mimeType ? { UTI: options.mimeType } : {}),
      });
      shared = true;
    }

    let opened = false;
  if (!shared && options.openAfterDownload) {
      opened = await tryOpenFile(downloadedFile.uri);
    }

    return {
      uri: downloadedFile.uri,
      fileName,
      shared,
      opened,
      directoryUri: directory.uri,
    };
  } catch (error) {
    if (targetFile.exists) {
      try {
        targetFile.delete();
      } catch {}
    }
    throw error instanceof Error
      ? error
      : new Error('Failed to download file');
  }
};
