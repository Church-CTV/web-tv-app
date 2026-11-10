"""Bounded ZIP/XML policy; XMLDSig canonicalization and crypto belong to xmlsec1."""
import base64
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import xml.etree.ElementTree as ET
import zipfile
from urllib.parse import unquote

DS = '{http://www.w3.org/2000/09/xmldsig#}'


def verify(path):
    with zipfile.ZipFile(path) as archive:
        entries = {}
        total = 0
        for item in archive.infolist():
            name = item.filename
            parts = name.rstrip('/').split('/')
            if (not name or '\\' in name or name.startswith('/') or
                    any(p in ('', '.', '..') for p in parts) or ':' in name or
                    '\x00' in name):
                raise ValueError('unsafe archive path: ' + repr(name))
            if name in entries:
                raise ValueError('duplicate archive entry: ' + name)
            if (item.external_attr >> 16) & 0o170000 == 0o120000:
                raise ValueError('unsafe archive symlink: ' + name)
            total += item.file_size
            if total > 256 * 1024 * 1024:
                raise ValueError('archive exceeds 256 MiB limit')
            entries[name] = None if item.is_dir() else archive.read(item)
    for name in ('config.xml', 'author-signature.xml', 'signature1.xml'):
        if entries.get(name) is None:
            raise ValueError('missing root ' + name)
    binary = os.environ.get('TIZEN_XMLSEC1', 'xmlsec1')
    if not shutil.which(binary):
        raise ValueError('xmlsec1 verifier unavailable; install xmlsec1 (OpenSSL backend)')
    payload = {n for n, data in entries.items() if data is not None} - {'author-signature.xml', 'signature1.xml'}
    with tempfile.TemporaryDirectory(prefix='tizen-verify-') as directory:
        root = Path(directory)
        for name, data in entries.items():
            if data is not None:
                target = root / name
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(data)
        for name, expected in [('author-signature.xml', payload),
                               ('signature1.xml', payload | {'author-signature.xml'})]:
            raw = entries[name]
            if b'<!DOCTYPE' in raw.upper() or b'<!ENTITY' in raw.upper():
                raise ValueError(name + ': DTD/entities forbidden')
            doc = ET.fromstring(raw)
            if doc.tag != DS + 'Signature':
                raise ValueError(name + ': XMLDSig Signature root required')
            if (list(doc.iter(DS + 'RetrievalMethod')) or
                    list(doc.iter('{http://www.w3.org/2009/xmldsig11#}KeyInfoReference'))):
                raise ValueError(name + ': external key retrieval forbidden')
            if list(doc.iter(DS + 'Manifest')):
                raise ValueError(name + ': XMLDSig Manifest forbidden')
            info = doc.findall(DS + 'SignedInfo')
            if len(info) != 1:
                raise ValueError(name + ': exactly one SignedInfo required')
            allowed_transforms = {
                'http://www.w3.org/TR/2001/REC-xml-c14n-20010315',
                'http://www.w3.org/TR/2001/REC-xml-c14n-20010315#WithComments',
                'http://www.w3.org/2001/10/xml-exc-c14n#',
                'http://www.w3.org/2001/10/xml-exc-c14n#WithComments',
                'http://www.w3.org/2006/12/xml-c14n11',
                'http://www.w3.org/2006/12/xml-c14n11#WithComments',
            }
            for transform in doc.iter(DS + 'Transform'):
                if transform.get('Algorithm') not in allowed_transforms:
                    raise ValueError(name + ': unsupported XMLDSig transform')
            covered = set()
            ids = {}
            for element in doc.iter():
                for attr, value in element.attrib.items():
                    if attr in ('Id', 'ID', 'id', '{http://www.w3.org/XML/1998/namespace}id'):
                        if value in ids:
                            raise ValueError('duplicate XML ID')
                        ids[value] = element
            for ref in info[0].findall(DS + 'Reference'):
                uri = ref.get('URI', '')
                if uri.startswith('#'):
                    if uri[1:] not in ids:
                        raise ValueError('dangling XML reference: ' + uri)
                    continue
                uri = unquote(uri, errors='strict')
                if uri not in expected or uri in covered:
                    raise ValueError(name + ': unexpected/duplicate/dangling payload reference: ' + uri)
                if ref.find(DS + 'Transforms') is not None:
                    raise ValueError(name + ': payload transforms unsupported; raw bytes required')
                covered.add(uri)
            if covered != expected:
                raise ValueError(name + ': unsigned payload/coverage mismatch: ' + ', '.join(sorted(expected - covered)))
            cert = doc.find('./' + DS + 'KeyInfo/' + DS + 'X509Data/' + DS + 'X509Certificate')
            if cert is None or not cert.text:
                raise ValueError(name + ': embedded signer X509 certificate required')
            der = base64.b64decode(''.join(cert.text.split()), validate=True)
            cert_path = root / '.verifier-cert.der'
            cert_path.write_bytes(der)
            pub = subprocess.run(['openssl', 'x509', '-inform', 'DER', '-in', str(cert_path), '-pubkey', '-noout'], capture_output=True, check=True).stdout
            key_path = root / '.verifier-key.pem'
            key_path.write_bytes(pub)
            result = subprocess.run([binary, '--verify', '--pubkey-pem', str(key_path),
                                     '--enabled-reference-uris', 'same-doc,local,remote',
                                     '--id-attr:Id', 'http://www.w3.org/2000/09/xmldsig#:SignatureProperties',
                                     str(root / name)], cwd=root, capture_output=True, text=True, timeout=30)
            if result.returncode:
                raise ValueError(name + ': XMLDSig cryptographic verification failed: ' + result.stderr)
            print(name + ': payload digests and XMLDSig signature verified')
    print('WGT cryptographic integrity verified; certificate trust/Samsung store approval NOT verified')


try:
    verify(sys.argv[1])
except Exception as error:
    print('Tizen signature validation failed: ' + str(error), file=sys.stderr)
    sys.exit(1)
