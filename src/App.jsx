import { useEffect, useMemo, useRef, useState } from 'react';

const uid = () => Math.random().toString(36).slice(2, 9);
const read = (key, fallback) => {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return value ?? fallback;
  } catch {
    return fallback;
  }
};
const useStored = (key, fallback) => {
  const [value, setValue] = useState(() => read(key, fallback));
  useEffect(() => localStorage.setItem(key, JSON.stringify(value)), [key, value]);
  return [value, setValue];
};
const getRoute = () => window.location.hash.slice(1) || '/login';
const navigate = (route) => {
  if (getRoute() !== route) window.location.hash = route;
};
const slugify = (value) => value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const fmt = (time) => new Date(time).toLocaleString();
const fmtDate = (time) => {
  const date = new Date(time);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};
const BLOCKS = ['heading', 'paragraph', 'image', 'button', 'quote', 'divider', 'gallery', 'video', 'code', 'callout'];
const TEMPLATES = {
  blog: {
    title: 'Blog Post',
    blocks: [
      ['heading', 'Introduction'],
      ['paragraph', 'Write your opening paragraph here.'],
      ['heading', 'Main Section'],
      ['paragraph', 'Add your main content.'],
    ],
  },
  product: {
    title: 'Product Page',
    blocks: [
      ['heading', 'What We Offer'],
      ['image', 'Product image'],
      ['paragraph', 'Describe your product and its benefits.'],
      ['button', 'Learn More', 'https://example.com'],
    ],
  },
  gallery: {
    title: 'Photo Gallery',
    blocks: [
      ['heading', 'Our Work'],
      ['gallery', '', 'https://via.placeholder.com/300\nhttps://via.placeholder.com/300\nhttps://via.placeholder.com/300'],
    ],
  },
};

function makeBlock(type, text = '', url = '', gallery = '') {
  return { id: uid(), type, text, url, gallery, label: '', video: '' };
}
function newPage(user) {
  return {
    id: uid(),
    title: '',
    slug: '',
    template: 'classic',
    blocks: [],
    seo: { title: '', desc: '', keywords: '' },
    status: 'draft',
    authorId: user.id,
    author: user.name,
    views: 0,
    updated: Date.now(),
    publishDate: null,
    note: '',
    comments: [],
  };
}
function PageFromTemplate(user, key) {
  const template = TEMPLATES[key];
  const page = newPage(user);
  page.title = template.title;
  page.blocks = template.blocks.map(([type, text = '', extra = '']) =>
    type === 'gallery' ? makeBlock(type, text, '', extra) : makeBlock(type, text, extra));
  return page;
}
function seoCheck(page) {
  const blocks = page.blocks || [];
  const seo = page.seo || { title: '', desc: '', keywords: '' };
  const words = blocks
    .filter((block) => ['paragraph', 'heading', 'quote', 'callout'].includes(block.type))
    .map((block) => block.text || '')
    .join(' ')
    .split(/\s+/)
    .filter(Boolean).length;
  const keywords = (seo.keywords || '').split(',').map((word) => word.trim().toLowerCase()).filter(Boolean);
  const checks = [
    [seo.title.length >= 30 && seo.title.length <= 60, 'SEO title is 30–60 characters'],
    [seo.desc.length >= 70 && seo.desc.length <= 160, 'Meta description is 70–160 characters'],
    [keywords.length >= 2, 'At least 2 keywords'],
    [keywords.length > 0 && keywords.some((word) => page.title.toLowerCase().includes(word)), 'A keyword appears in the page title'],
    [blocks.some((block) => block.type === 'heading'), 'Page has a heading block'],
    [words >= 50, `Content has 50+ words (${words})`],
    [!!page.slug, 'URL slug is set'],
  ];
  return { checks, score: Math.round((checks.filter(([passed]) => passed).length / checks.length) * 100) };
}

function RichText({ text = '' }) {
  const regex = /\*\*([^*]+)\*\*|_([^_]+)_|\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g;
  const output = [];
  let last = 0;
  let match;
  while ((match = regex.exec(text))) {
    if (match.index > last) output.push(text.slice(last, match.index));
    if (match[1]) output.push(<strong key={match.index}>{match[1]}</strong>);
    else if (match[2]) output.push(<em key={match.index}>{match[2]}</em>);
    else output.push(<a key={match.index} href={match[4]} target="_blank" rel="noopener noreferrer">{match[3]}</a>);
    last = regex.lastIndex;
  }
  if (last < text.length) output.push(text.slice(last));
  return output;
}

function PageContent({ page }) {
  return (
    <article className={`tpl tpl-${page.template || 'classic'}`}>
      <h1>{page.title}</h1>
      {(page.blocks || []).map((block) => {
        switch (block.type) {
          case 'heading': return <h2 key={block.id}><RichText text={block.text} /></h2>;
          case 'paragraph': return <p key={block.id}><RichText text={block.text} /></p>;
          case 'quote': return <blockquote key={block.id}><RichText text={block.text} /></blockquote>;
          case 'image': return block.url ? <img key={block.id} src={block.url} alt={block.text || ''} /> : null;
          case 'button': return <a key={block.id} className="cta" href={/^https?:\/\//i.test(block.url) ? block.url : '#'} target="_blank" rel="noopener noreferrer">{block.text || 'Click'}</a>;
          case 'divider': return <hr key={block.id} />;
          case 'gallery': {
            const images = (block.gallery || '').split('\n').filter(Boolean);
            return images.length ? <div className="gallery" key={block.id}>{images.map((url, index) => <img src={url} alt="" key={`${url}-${index}`} />)}</div> : null;
          }
          case 'video': return block.url ? <iframe key={block.id} title="Embedded video" width="100%" height="360" src={block.url} frameBorder="0" allow="autoplay; encrypted-media" allowFullScreen /> : null;
          case 'code': return <pre key={block.id}><code>{block.text}</code></pre>;
          case 'callout': return <div key={block.id} className="callout"><strong>{block.label || 'Note'}:</strong> <RichText text={block.text} /></div>;
          default: return null;
        }
      })}
    </article>
  );
}

function ThemeButton({ dark, onClick }) {
  return <button className="theme-tog" type="button" aria-label="Toggle dark mode" onClick={onClick}>{dark ? '☀️' : '🌙'}</button>;
}
function Header({ user, dark, onToggle, onLogout, view = false }) {
  return (
    <div className={view ? 'viewbar' : 'topbar'}>
      <b>PageForge</b><span style={{ flex: 1 }} />
      {user && !view && <span style={{ fontSize: 13 }}>{user.name}</span>}
      <ThemeButton dark={dark} onClick={onToggle} />
      {view ? <a href="#/author">← Back</a> : user && <a href="#/login" onClick={(event) => { event.preventDefault(); onLogout(); }}>Log out</a>}
    </div>
  );
}
function Toast({ message }) {
  return message ? <div className="toast" role="status">{message}</div> : null;
}

function Auth({ users, setUsers, setSession, dark, toggleTheme }) {
  const [tab, setTab] = useState('login');
  const [login, setLogin] = useState({ email: '', pass: '' });
  const [signup, setSignup] = useState({ name: '', email: '', pass: '', role: 'user', code: '' });
  const [message, setMessage] = useState('');
  const submitLogin = (event) => {
    event.preventDefault();
    const user = users.find((item) => item.email === login.email.trim().toLowerCase() && item.pass === login.pass);
    if (!user) { setMessage('Wrong email or password.'); return; }
    setSession(user.id);
    navigate(user.role === 'admin' ? '/admin' : '/author');
  };
  const submitSignup = (event) => {
    event.preventDefault();
    const email = signup.email.trim().toLowerCase();
    if (users.some((item) => item.email === email)) { setMessage('This email is already registered.'); return; }
    if (signup.role === 'admin' && signup.code !== 'ADMIN2026') { setMessage('Invalid admin code.'); return; }
    const user = { id: uid(), name: signup.name.trim(), email, pass: signup.pass, role: signup.role };
    setUsers((current) => [...current, user]);
    setMessage('Account created. Please log in.');
    setTab('login');
    setLogin({ email, pass: '' });
    setSignup({ name: '', email: '', pass: '', role: 'user', code: '' });
  };
  return (
    <>
      <Header dark={dark} onToggle={toggleTheme} />
      <div className="auth">
        <section className="hero">
          <h1>Build and publish web pages without code.</h1>
          <p>PageForge is a content management system where authors draft pages with drag-and-drop blocks, rich text formatting, and admins review, schedule and publish them.</p>
          <ul>{['🎨 Drag-and-drop editor', '📅 Schedule posts', '✅ Approval workflow', '📊 Version history', '💬 Comments', '🌙 Dark mode'].map((feature) => <li key={feature}>{feature}</li>)}</ul>
        </section>
        <section className="formside">
          <div className="box">
            <div className="tabs">
              <button className={tab === 'login' ? 'on' : ''} onClick={() => { setTab('login'); setMessage(''); }}>Log in</button>
              <button className={tab === 'signup' ? 'on' : ''} onClick={() => { setTab('signup'); setMessage(''); }}>Sign up</button>
            </div>
            {tab === 'login' ? (
              <form onSubmit={submitLogin}>
                <label>Email<input type="email" required value={login.email} onChange={(event) => setLogin({ ...login, email: event.target.value })} /></label>
                <label>Password<input type="password" required value={login.pass} onChange={(event) => setLogin({ ...login, pass: event.target.value })} /></label>
                <div className="msg">{message}</div><button className="pri" style={{ width: '100%' }}>Log in</button>
                <p className="hint">Demo: admin@cms.com / admin123</p>
              </form>
            ) : (
              <form onSubmit={submitSignup}>
                <label>Full name<input required value={signup.name} onChange={(event) => setSignup({ ...signup, name: event.target.value })} /></label>
                <label>Email<input type="email" required value={signup.email} onChange={(event) => setSignup({ ...signup, email: event.target.value })} /></label>
                <label>Password (min 6)<input type="password" minLength="6" required value={signup.pass} onChange={(event) => setSignup({ ...signup, pass: event.target.value })} /></label>
                <label>Account type<select value={signup.role} onChange={(event) => setSignup({ ...signup, role: event.target.value })}><option value="user">User (author)</option><option value="admin">Admin</option></select></label>
                {signup.role === 'admin' && <label>Admin code<input value={signup.code} onChange={(event) => setSignup({ ...signup, code: event.target.value })} /></label>}
                <div className="msg">{message}</div><button className="pri" style={{ width: '100%' }}>Create account</button>
                <p className="hint">Admin code: ADMIN2026</p>
              </form>
            )}
          </div>
        </section>
      </div>
    </>
  );
}

function SeoPanel({ page }) {
  const result = seoCheck(page);
  return <><div className="score">SEO score {result.score}%</div><ul className="seo" style={{ padding: 0 }}>{result.checks.map(([passed, label]) => <li key={label} className={passed ? 'ok' : 'no'}>{label}</li>)}</ul></>;
}
function PageEditor({ page: original, actions, onAction, onBack, setToast }) {
  const [page, setPage] = useState(() => structuredClone(original));
  const [slugTouched, setSlugTouched] = useState(!!original.slug);
  const [preview, setPreview] = useState(false);
  const textareas = useRef({});
  const update = (key, value) => setPage((current) => ({ ...current, [key]: value }));
  const updateSeo = (key, value) => setPage((current) => ({ ...current, seo: { ...current.seo, [key]: value } }));
  const updateBlock = (index, key, value) => setPage((current) => ({
    ...current,
    blocks: current.blocks.map((block, blockIndex) => blockIndex === index ? { ...block, [key]: value } : block),
  }));
  const addBlock = (type, index = page.blocks.length) => setPage((current) => {
    const blocks = current.blocks.slice();
    blocks.splice(index, 0, makeBlock(type));
    return { ...current, blocks };
  });
  const removeBlock = (index) => setPage((current) => ({ ...current, blocks: current.blocks.filter((_, blockIndex) => blockIndex !== index) }));
  const reorder = (from, to) => setPage((current) => {
    const blocks = current.blocks.slice();
    const [item] = blocks.splice(from, 1);
    blocks.splice(from < to ? to - 1 : to, 0, item);
    return { ...current, blocks };
  });
  const richAction = (index, kind) => {
    const textarea = textareas.current[index];
    if (!textarea) return;
    const value = page.blocks[index].text || '';
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = value.slice(start, end) || value || 'text';
    const replacement = kind === 'b' ? `**${selected}**` : kind === 'i' ? `_${selected}_` : `[${selected}](https://example.com)`;
    updateBlock(index, 'text', value.slice(0, start) + replacement + value.slice(end));
  };
  const save = (action) => {
    if (!page.title.trim()) { setToast('Add a page title first'); return; }
    const result = { ...page, slug: page.slug || slugify(page.title) };
    onAction(action, result);
  };
  const scorePage = useMemo(() => page, [page]);
  return (
    <div>
      <div className="top"><h1>{page.title ? 'Edit page' : 'New page'}</h1><button onClick={onBack}>Back</button></div>
      <div className="editor">
        <aside className="palette">
          <h4>Drag a block</h4>
          {BLOCKS.map((type) => <div key={type} className="pal" role="button" tabIndex="0" draggable onClick={() => addBlock(type)} onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); addBlock(type); }
          }} onDragStart={(event) => event.dataTransfer.setData('text/plain', `new:${type}`)}>{type}</div>)}
        </aside>
        <section className="canvas-wrap">
          <div className="g2">
            <label>Page title<input maxLength="90" value={page.title} onChange={(event) => {
              const title = event.target.value;
              setPage((current) => ({ ...current, title, slug: slugTouched ? current.slug : slugify(title) }));
            }} /></label>
            <label>Template<select value={page.template || 'classic'} onChange={(event) => update('template', event.target.value)}><option value="classic">Classic</option><option value="modern">Modern</option><option value="bold">Bold</option></select></label>
          </div>
          <div className="canvas" onDragOver={(event) => event.preventDefault()} onDrop={(event) => {
            event.preventDefault();
            const type = event.dataTransfer.getData('text/plain');
            if (type.startsWith('new:')) addBlock(type.slice(4));
          }}>
            {!page.blocks.length && <span style={{ color: 'var(--mut)', margin: 'auto' }}>Drag blocks here</span>}
            {page.blocks.map((block, index) => (
              <div className="blk" key={block.id} onDragOver={(event) => event.preventDefault()} onDrop={(event) => {
                event.preventDefault();
                event.stopPropagation();
                const data = event.dataTransfer.getData('text/plain');
                if (data.startsWith('new:')) addBlock(data.slice(4), index);
                else if (data.startsWith('move:')) reorder(Number(data.slice(5)), index);
              }}>
                <span className="hd" draggable onDragStart={(event) => event.dataTransfer.setData('text/plain', `move:${index}`)}>⋮⋮</span>
                <div className="f"><b>{block.type}</b>
                  {block.type === 'divider' ? <span style={{ color: 'var(--mut)' }}>Horizontal line</span> : <>
                    {['heading', 'paragraph', 'quote'].includes(block.type) && <div className="rt-bar">{[['b', 'B'], ['i', 'I'], ['l', '🔗']].map(([kind, label]) => <button key={kind} type="button" onClick={() => richAction(index, kind)}>{label}</button>)}</div>}
                    {block.type === 'image' && <><input placeholder="Image URL" value={block.url} onChange={(event) => updateBlock(index, 'url', event.target.value)} /><input placeholder="Alt text" value={block.text} onChange={(event) => updateBlock(index, 'text', event.target.value)} /></>}
                    {block.type === 'button' && <><input placeholder="Button label" value={block.text} onChange={(event) => updateBlock(index, 'text', event.target.value)} /><input placeholder="Link" value={block.url} onChange={(event) => updateBlock(index, 'url', event.target.value)} /></>}
                    {block.type === 'gallery' && <textarea rows="3" placeholder="Image URLs, one per line" value={block.gallery} onChange={(event) => updateBlock(index, 'gallery', event.target.value)} />}
                    {block.type === 'video' && <input placeholder="YouTube/Vimeo embed URL" value={block.url} onChange={(event) => updateBlock(index, 'url', event.target.value)} />}
                    {block.type === 'code' && <textarea rows="4" placeholder="Code here" style={{ fontFamily: 'monospace' }} value={block.text} onChange={(event) => updateBlock(index, 'text', event.target.value)} />}
                    {block.type === 'callout' && <><input placeholder="Note type (e.g. Warning)" value={block.label} onChange={(event) => updateBlock(index, 'label', event.target.value)} /><textarea rows="2" placeholder="Message" value={block.text} onChange={(event) => updateBlock(index, 'text', event.target.value)} /></>}
                    {['heading', 'paragraph', 'quote'].includes(block.type) && <textarea ref={(element) => { textareas.current[index] = element; }} rows={block.type === 'paragraph' ? 3 : 2} placeholder="Write here…" value={block.text} onChange={(event) => updateBlock(index, 'text', event.target.value)} />}
                  </>}
                </div>
                <button className="sm dng" type="button" onClick={() => removeBlock(index)} aria-label={`Remove ${block.type} block`}>✕</button>
              </div>
            ))}
          </div>
          {preview && <div className="prev"><PageContent page={page} /></div>}
        </section>
        <aside className="eside">
          <h4>Publishing</h4>
          <label>URL slug<input value={page.slug} onChange={(event) => { setSlugTouched(true); update('slug', slugify(event.target.value)); }} /></label>
          <label>Publish date<input type="datetime-local" value={page.publishDate ? fmtDate(page.publishDate) : ''} onChange={(event) => update('publishDate', event.target.value ? new Date(event.target.value).getTime() : null)} /></label>
          <h4 style={{ marginTop: 14 }}>SEO</h4>
          <label>Title<input value={page.seo.title} onChange={(event) => updateSeo('title', event.target.value)} /></label>
          <label>Description<textarea rows="3" value={page.seo.desc} onChange={(event) => updateSeo('desc', event.target.value)} /></label>
          <label>Keywords<input value={page.seo.keywords} onChange={(event) => updateSeo('keywords', event.target.value)} /></label>
          <SeoPanel page={scorePage} />
          <div className="row" style={{ marginTop: 10 }}>
            <button className="sm" onClick={() => setPreview(!preview)}>{preview ? 'Hide preview' : 'Preview'}</button>
            {actions.map((action) => <button key={action.id} className={`sm ${action.pri ? 'pri' : ''}`} onClick={() => save(action.id)}>{action.label}</button>)}
          </div>
        </aside>
      </div>
    </div>
  );
}

function App() {
  const [route, setRoute] = useState(getRoute);
  useEffect(() => {
    const updateRoute = () => setRoute(getRoute());
    window.addEventListener('hashchange', updateRoute);
    return () => window.removeEventListener('hashchange', updateRoute);
  }, []);
  const path = route.split('?')[0];
  const mode = path === '/admin' ? 'admin' : path === '/author' ? 'user' : path.startsWith('/page/') ? 'view' : 'auth';
  const [users, setUsers] = useStored('users', []);
  const [pages, setPages] = useStored('pages', []);
  const [comments, setComments] = useStored('comments', {});
  const [versions, setVersions] = useStored('versions', {});
  const [session, setSession] = useState(() => localStorage.getItem('session'));
  const [dark, setDark] = useStored('dark', false);
  const [toast, setToast] = useState('');
  const user = users.find((item) => item.id === session);
  const viewId = mode === 'view' ? decodeURIComponent(path.slice('/page/'.length)) : null;
  const viewPage = pages.find((item) => item.id === viewId);
  const shouldAutoPublish = viewPage?.status === 'scheduled' && viewPage.publishDate && viewPage.publishDate <= Date.now();
  const isAvailableView = viewPage && (viewPage.status === 'published' || shouldAutoPublish) && (!viewPage.publishDate || viewPage.publishDate <= Date.now());

  useEffect(() => {
    if (!users.length) setUsers([{ id: uid(), name: 'Admin', email: 'admin@cms.com', pass: 'admin123', role: 'admin' }]);
  }, [users, setUsers]);
  useEffect(() => {
    document.documentElement.setAttribute('data-dark', dark ? '1' : '0');
  }, [dark]);
  useEffect(() => {
    if (!toast) return undefined;
    const timeout = window.setTimeout(() => setToast(''), 2200);
    return () => window.clearTimeout(timeout);
  }, [toast]);
  useEffect(() => {
    if (session) localStorage.setItem('session', session);
    else localStorage.removeItem('session');
  }, [session]);
  useEffect(() => {
    if (mode === 'auth' && user) navigate(user.role === 'admin' ? '/admin' : '/author');
    else if (mode !== 'auth' && !user) navigate('/login');
    else if (['admin', 'user'].includes(mode) && ((mode === 'admin') !== (user?.role === 'admin'))) navigate(user.role === 'admin' ? '/admin' : '/author');
  }, [mode, user]);
  useEffect(() => {
    if (mode === 'view' && shouldAutoPublish && viewId) {
      setPages((current) => current.map((item) => item.id === viewId ? { ...item, status: 'published', publishDate: null, updated: Date.now() } : item));
    }
  }, [mode, shouldAutoPublish, viewId, setPages]);
  useEffect(() => {
    if (mode !== 'view' || !isAvailableView || !viewId || sessionStorage.getItem(`v${viewId}`)) return;
    sessionStorage.setItem(`v${viewId}`, '1');
    setPages((current) => current.map((item) => item.id === viewId ? { ...item, views: (item.views || 0) + 1 } : item));
  }, [mode, isAvailableView, viewId, setPages]);
  useEffect(() => {
    const titles = { auth: 'PageForge CMS', admin: 'PageForge – Admin', user: 'PageForge – Author' };
    document.title = mode === 'view'
      ? (isAvailableView ? (viewPage.seo?.title || viewPage.title) : 'Page')
      : titles[mode];
    const description = document.querySelector('meta[name="description"]');
    const keywords = document.querySelector('meta[name="keywords"]');
    if (description) description.content = viewPage?.seo?.desc || '';
    if (keywords) keywords.content = viewPage?.seo?.keywords || '';
  }, [mode, isAvailableView, viewPage]);

  const toggleTheme = () => setDark((value) => !value);
  const logout = () => {
    setSession(null);
    navigate('/login');
  };

  if (mode === 'view') {
    if (!user) return null;
    return <><Header user={user} dark={dark} onToggle={toggleTheme} view />{isAvailableView ? <div className="viewwrap"><PageContent page={viewPage} /></div> : <div className="empty" style={{ margin: 24 }}>This page is not available.</div>}</>;
  }

  if (mode === 'auth') {
    if (user) return null;
    return <><Auth users={users} setUsers={setUsers} setSession={setSession} dark={dark} toggleTheme={toggleTheme} /><Toast message={toast} /></>;
  }
  if (!user || ((mode === 'admin') !== (user.role === 'admin'))) return null;
  return <Workspace mode={mode} user={user} users={users} setUsers={setUsers} pages={pages} setPages={setPages} comments={comments} setComments={setComments} versions={versions} setVersions={setVersions} dark={dark} toggleTheme={toggleTheme} logout={logout} setToast={setToast} toast={toast} />;
}

function Workspace({ mode, user, users, setUsers, pages, setPages, comments, setComments, versions, setVersions, dark, toggleTheme, logout, setToast, toast }) {
  const [view, setView] = useState(mode === 'admin' ? 'dash' : 'mine');
  const [editing, setEditing] = useState(null);
  const isAdmin = mode === 'admin';
  const ownPages = pages.filter((page) => page.authorId === user.id);
  const go = (next, page = null) => { setView(next); setEditing(page); };
  const savePage = (page) => setPages((current) => {
    const index = current.findIndex((item) => item.id === page.id);
    if (index < 0) return [...current, page];
    return current.map((item, itemIndex) => itemIndex === index ? page : item);
  });
  const deletePage = (id) => setPages((current) => current.filter((page) => page.id !== id));
  const actionForEditor = (action, page) => {
    if (pages.some((item) => item.slug === page.slug && item.id !== page.id)) { setToast('URL slug already used'); return; }
    const updated = { ...page, updated: Date.now() };
    if (isAdmin) {
      updated.status = action === 'pub' ? 'published' : (updated.publishDate && updated.publishDate > Date.now() ? 'scheduled' : 'draft');
    } else {
      updated.status = action === 'sub' ? 'pending' : 'draft';
      updated.note = '';
    }
    if (pages.some((item) => item.id === page.id)) {
      const existing = pages.find((item) => item.id === page.id);
      updated.views = existing.views || 0;
    }
    setVersions((current) => ({ ...current, [page.id]: [...(current[page.id] || []), { id: uid(), title: page.title, updated: Date.now(), blocks: page.blocks.length }] }));
    savePage(updated);
    setToast(action === 'pub' ? 'Published' : action === 'sub' ? 'Submitted' : 'Saved');
    go(isAdmin ? 'pages' : 'mine');
  };

  const nav = isAdmin
    ? [['dash', 'Analytics'], ['pages', 'All pages'], ['appr', 'Approvals'], ['sched', 'Scheduled'], ['users', 'Users']]
    : [['mine', 'My pages'], ['browse', 'Published'], ['hist', 'Version history'], ['stats', 'My stats']];
  const pendingCount = pages.filter((page) => page.status === 'pending').length;
  return (
    <>
      <Header user={user} dark={dark} onToggle={toggleTheme} onLogout={logout} />
      <div className="shell">
        <nav className="side">
          <h2>{isAdmin ? 'Admin' : 'Author'}</h2><small>{user.name} · {isAdmin ? 'Admin' : 'Author'}</small>
          {nav.map(([key, label]) => <a key={key} href="#" className={view === key || (view === 'edit' && key === (isAdmin ? 'pages' : 'mine')) ? 'on' : ''} onClick={(event) => { event.preventDefault(); go(key); }}>{label}{key === 'appr' && pendingCount ? ` (${pendingCount})` : ''}</a>)}
          <span className="sp" /><a href="#/login" onClick={(event) => { event.preventDefault(); logout(); }}>Log out</a>
        </nav>
        <main>
          {view === 'edit' && editing && <PageEditor key={editing.id} page={editing} actions={isAdmin ? [{ id: 'save', label: 'Save' }, { id: 'pub', label: 'Publish', pri: true }] : [{ id: 'save', label: 'Save' }, { id: 'sub', label: 'Submit', pri: true }]} onAction={actionForEditor} onBack={() => go(isAdmin ? 'pages' : 'mine')} setToast={setToast} />}
          {isAdmin && view === 'dash' && <AdminDashboard pages={pages} users={users} />}
          {isAdmin && view === 'pages' && <AdminPages pages={pages} onEdit={(page) => go('edit', page)} onNew={() => go('edit', newPage(user))} onDelete={deletePage} />}
          {isAdmin && view === 'appr' && <Approvals user={user} pages={pages} comments={comments} setComments={setComments} setPages={setPages} onEdit={(page) => go('edit', page)} setToast={setToast} />}
          {isAdmin && view === 'sched' && <Scheduled pages={pages} setPages={setPages} onEdit={(page) => go('edit', page)} onDelete={deletePage} setToast={setToast} />}
          {isAdmin && view === 'users' && <UserManagement users={users} setUsers={setUsers} currentUser={user} setToast={setToast} />}
          {!isAdmin && view === 'mine' && <MyPages pages={ownPages} onEdit={(page) => go('edit', page)} onNew={() => go('edit', newPage(user))} onTemplate={() => go('templates')} onDelete={deletePage} />}
          {!isAdmin && view === 'templates' && <TemplatePicker onChoose={(key) => go('edit', PageFromTemplate(user, key))} />}
          {!isAdmin && view === 'browse' && <PublishedPages pages={pages} />}
          {!isAdmin && view === 'hist' && <VersionHistory pages={ownPages} versions={versions} />}
          {!isAdmin && view === 'stats' && <AuthorStats pages={ownPages} />}
        </main>
      </div>
      <Toast message={toast} />
    </>
  );
}

function AdminDashboard({ pages, users }) {
  const published = pages.filter((page) => page.status === 'published' && (!page.publishDate || page.publishDate <= Date.now()));
  const maxViews = Math.max(1, ...pages.map((page) => page.views || 0));
  return <>
    <div className="top"><h1>Analytics</h1></div>
    <div className="cards">
      {[[pages.length, 'Total pages'], [published.length, 'Published'], [pages.filter((page) => page.status === 'pending').length, 'In review'], [pages.filter((page) => page.publishDate && page.publishDate > Date.now()).length, 'Scheduled']].map(([value, label]) => <div className="stat" key={label}><b>{value}</b><span>{label}</span></div>)}
      <div className="stat"><b>{users.length}</b><span>Users</span></div>
    </div>
    <div className="panel"><h3 style={{ marginBottom: 12 }}>Views per page</h3>{pages.length ? <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{[...pages].sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 8).map((page) => <div key={page.id} style={{ display: 'grid', gridTemplateColumns: '140px 1fr 40px', gap: 10, alignItems: 'center', fontSize: 13 }}><span>{page.title.slice(0, 18)}</span><i style={{ display: 'block', height: 14, background: 'var(--acc)', borderRadius: 4, width: `${(page.views || 0) / maxViews * 100}%` }} /><b>{page.views || 0}</b></div>)}</div> : <div className="empty" style={{ padding: 20 }}>No pages yet</div>}</div>
  </>;
}

function TableWrap({ children }) { return <div className="tw" style={{ overflowX: 'auto' }}>{children}</div>; }
function AdminPages({ pages, onEdit, onNew, onDelete }) {
  return <>
    <div className="top"><h1>All pages</h1><button className="pri" onClick={onNew}>New page</button></div>
    {pages.length ? <TableWrap><table><thead><tr><th>Title</th><th>Author</th><th>Status</th><th>Views</th><th>Updated</th><th /></tr></thead><tbody>{pages.map((page) => <tr key={page.id}><td><strong>{page.title.slice(0, 40)}</strong><br /><small style={{ color: 'var(--mut)' }}>/{page.slug}</small></td><td>{page.author}</td><td><span className={`chip ${page.publishDate && page.publishDate > Date.now() ? 'scheduled' : page.status}`}>{page.publishDate && page.publishDate > Date.now() ? 'scheduled' : page.status}</span></td><td>{page.views || 0}</td><td>{fmt(page.updated).slice(0, 10)}</td><td className="row"><button className="sm" onClick={() => onEdit(page)}>Edit</button>{page.status === 'published' && <a className="btn sm" href={`#/page/${encodeURIComponent(page.id)}`} target="_blank" rel="noreferrer">View</a>}<button className="sm dng" onClick={() => window.confirm('Delete this page?') && onDelete(page.id)}>Delete</button></td></tr>)}</tbody></table></TableWrap> : <div className="empty">No pages yet.</div>}
  </>;
}
function MyPages({ pages, onEdit, onNew, onTemplate, onDelete }) {
  return <>
    <div className="top"><h1>My pages</h1><button className="pri" onClick={onNew}>New page</button><button onClick={onTemplate}>Use template</button></div>
    {pages.length ? <TableWrap><table><thead><tr><th>Title</th><th>Status</th><th>Views</th><th>Updated</th><th /></tr></thead><tbody>{pages.map((page) => {
      const status = page.publishDate && page.publishDate > Date.now() ? 'scheduled' : page.status;
      return <tr key={page.id}><td><strong>{page.title.slice(0, 40)}</strong>{status === 'rejected' && page.note && <><br /><small style={{ color: 'var(--bad)' }}>Rejected: {page.note}</small></>}</td><td><span className={`chip ${status}`}>{status}</span></td><td>{page.views || 0}</td><td>{fmt(page.updated).slice(0, 10)}</td><td className="row">{['draft', 'rejected'].includes(page.status) || status === 'scheduled' ? <button className="sm" onClick={() => onEdit(page)}>Edit</button> : status === 'published' ? <a className="btn sm" href={`#/page/${encodeURIComponent(page.id)}`} target="_blank" rel="noreferrer">View</a> : <small>In review</small>}{!['published', 'pending'].includes(page.status) && <button className="sm dng" onClick={() => window.confirm('Delete?') && onDelete(page.id)}>Delete</button>}</td></tr>;
    })}</tbody></table></TableWrap> : <div className="empty">No pages yet. Click "New page".</div>}
  </>;
}
function TemplatePicker({ onChoose }) {
  return <><div className="top"><h1>Choose a template</h1></div><div className="tpls">{Object.entries(TEMPLATES).map(([key, template]) => <button className="tpl-card" key={key} onClick={() => onChoose(key)}><b>{template.title}</b></button>)}</div></>;
}
function Approvals({ user, pages, comments, setComments, setPages, onEdit, setToast }) {
  const pending = pages.filter((page) => page.status === 'pending');
  const [preview, setPreview] = useState({});
  const [draftComments, setDraftComments] = useState({});
  const changeStatus = (page, status, note) => {
    setPages((current) => current.map((item) => item.id === page.id ? { ...item, status, note: note ?? item.note, updated: Date.now(), publishDate: status === 'published' && item.publishDate <= Date.now() ? null : item.publishDate } : item));
    setToast(status === 'published' ? 'Published' : 'Rejected');
  };
  const submitComment = (pageId) => {
    const text = (draftComments[pageId] || '').trim();
    if (!text) return;
    setComments((current) => ({ ...current, [pageId]: [...(current[pageId] || []), { id: uid(), author: user.name, text, time: Date.now() }] }));
    setDraftComments((current) => ({ ...current, [pageId]: '' }));
  };
  return <>
    <div className="top"><h1>Approvals ({pending.length})</h1></div>
    {pending.length ? pending.map((page) => <div className="panel" style={{ marginBottom: 14 }} key={page.id}>
      <div className="top" style={{ margin: '0 0 8px' }}><div><b>{page.title}</b><br /><small style={{ color: 'var(--mut)' }}>by {page.author} · SEO {seoCheck(page).score}%</small></div>
        <div className="row"><button className="sm" onClick={() => setPreview((current) => ({ ...current, [page.id]: !current[page.id] }))}>Preview</button><button className="sm" onClick={() => onEdit(page)}>Edit</button><button className="sm pri" onClick={() => changeStatus(page, 'published')}>Publish</button><button className="sm dng" onClick={() => { const reason = window.prompt('Reason:'); if (reason !== null) changeStatus(page, 'rejected', reason); }}>Reject</button></div>
      </div>
      {preview[page.id] && <div className="prev"><PageContent page={page} /></div>}
      <div className="comments"><h4>Comments ({(comments[page.id] || []).length})</h4>
        {(comments[page.id] || []).map((comment) => <div className="comment" key={comment.id}><b>{comment.author}</b><small>{fmt(comment.time)}</small><p>{comment.text}</p></div>)}
        {!comments[page.id]?.length && <small style={{ color: 'var(--mut)' }}>No comments yet.</small>}
        <div className="cmnt-form"><textarea rows="2" placeholder="Add a comment…" style={{ resize: 'vertical' }} value={draftComments[page.id] || ''} onChange={(event) => setDraftComments((current) => ({ ...current, [page.id]: event.target.value }))} /><button className="sm pri" onClick={() => submitComment(page.id)}>Comment</button></div>
      </div>
    </div>) : <div className="empty">Nothing to review.</div>}
  </>;
}
function Scheduled({ pages, setPages, onEdit, onDelete, setToast }) {
  const scheduled = pages.filter((page) => page.publishDate && page.publishDate > Date.now());
  const publishNow = (page) => {
    setPages((current) => current.map((item) => item.id === page.id ? { ...item, publishDate: null, status: 'published', updated: Date.now() } : item));
    setToast('Published now');
  };
  return <><div className="top"><h1>Scheduled ({scheduled.length})</h1></div>{scheduled.length ? scheduled.map((page) => <div className="panel" key={page.id} style={{ marginBottom: 12 }}><b>{page.title}</b><br /><small style={{ color: 'var(--mut)' }}>Publishes {fmt(page.publishDate)}</small><div className="row" style={{ marginTop: 8 }}><button className="sm" onClick={() => onEdit(page)}>Edit</button><button className="sm" onClick={() => publishNow(page)}>Publish now</button><button className="sm dng" onClick={() => window.confirm('Delete?') && onDelete(page.id)}>Delete</button></div></div>) : <div className="empty">No scheduled posts.</div>}</>;
}
function UserManagement({ users, setUsers, currentUser, setToast }) {
  const changeRole = (id, role) => {
    setUsers((current) => current.map((item) => item.id === id ? { ...item, role } : item));
    setToast('Updated');
  };
  const deleteUser = (id) => setUsers((current) => current.filter((item) => item.id !== id));
  return <><div className="top"><h1>Users ({users.length})</h1></div><TableWrap><table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th /></tr></thead><tbody>{users.map((item) => <tr key={item.id}><td>{item.name}</td><td>{item.email}</td><td><select disabled={item.id === currentUser.id} value={item.role} style={{ width: 'auto' }} onChange={(event) => changeRole(item.id, event.target.value)}><option value="user">User</option><option value="admin">Admin</option></select></td><td>{item.id === currentUser.id ? <small>You</small> : <button className="sm dng" onClick={() => window.confirm('Delete user?') && deleteUser(item.id)}>Delete</button>}</td></tr>)}</tbody></table></TableWrap></>;
}
function PublishedPages({ pages }) {
  const published = pages.filter((page) => page.status === 'published' && (!page.publishDate || page.publishDate <= Date.now()));
  return <><div className="top"><h1>Published pages</h1></div>{published.length ? <div className="cards">{published.map((page) => <div className="panel" key={page.id}><b>{page.title}</b><p style={{ color: 'var(--mut)', fontSize: 13, margin: '6px 0 12px' }}>{page.seo?.desc || 'No description'}</p><div className="pub-preview">{page.blocks.filter((block) => ['heading', 'paragraph', 'quote', 'callout'].includes(block.type) && block.text?.trim()).slice(0, 2).map((block) => <div className="pub-block" key={block.id}><small>{block.type}</small><p>{block.text}</p></div>)}</div><small>{page.views || 0} views</small><br /><a className="btn sm" style={{ marginTop: 8 }} href={`#/page/${encodeURIComponent(page.id)}`} target="_blank" rel="noreferrer">Read</a></div>)}</div> : <div className="empty">No pages published yet.</div>}</>;
}
function VersionHistory({ pages, versions }) {
  return <><div className="top"><h1>Version history</h1></div>{pages.length ? pages.map((page) => {
    const items = (versions[page.id] || []).slice().sort((a, b) => b.updated - a.updated);
    return <div className="panel" style={{ marginBottom: 14 }} key={page.id}><b>{page.title}</b><div className="version" style={{ marginTop: 10, border: 'none', padding: 0 }}><small>{items.length} version{items.length !== 1 ? 's' : ''}</small></div>{items.length ? items.map((item, index) => <div className={`version ${index === 0 ? 'cur' : ''}`} key={item.id}><b>v{items.length - index}</b><small>{fmt(item.updated)} · {item.blocks} block{item.blocks !== 1 ? 's' : ''}</small></div>) : <small style={{ color: 'var(--mut)' }}>No history yet</small>}</div>;
  }) : <div className="empty">No pages yet.</div>}</>;
}
function AuthorStats({ pages }) {
  const scheduled = pages.filter((page) => page.publishDate && page.publishDate > Date.now()).length;
  const stats = [[pages.length, 'Pages'], [pages.filter((page) => page.status === 'published').length, 'Published'], [pages.filter((page) => page.status === 'pending').length, 'In review'], [scheduled, 'Scheduled'], [pages.filter((page) => page.status === 'draft').length, 'Drafts'], [pages.reduce((total, page) => total + (page.views || 0), 0), 'Total views']];
  return <><div className="top"><h1>My stats</h1></div><div className="cards">{stats.map(([value, label]) => <div className="stat" key={label}><b>{value}</b><span>{label}</span></div>)}</div></>;
}

export default App;
