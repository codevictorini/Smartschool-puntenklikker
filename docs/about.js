(() => {
  'use strict';

  const siteAuth = window.PuntKlikSiteAuth;
  const categoryLabels = {
    head_dev: 'Head developer',
    staff: 'Staff team',
    dev: 'Dev team',
  };
  const groups = {
    head_dev: document.getElementById('head-dev-list'),
    staff: document.getElementById('staff-list'),
    dev: document.getElementById('dev-list'),
  };
  const aboutStatus = document.getElementById('about-status');
  const loginButton = document.getElementById('site-login');
  const logoutButton = document.getElementById('site-logout');
  const authStatus = document.getElementById('auth-status');
  const ownerLoginHint = document.getElementById('owner-login-hint');
  const ownerPanel = document.getElementById('owner-panel');
  const ownerStatus = document.getElementById('owner-status');
  const form = document.getElementById('about-form');
  const categoryInput = document.getElementById('member-category');
  const nameInput = document.getElementById('member-name');
  const roleInput = document.getElementById('member-role');
  const bioInput = document.getElementById('member-bio');
  const orderInput = document.getElementById('member-order');
  const saveButton = document.getElementById('member-save');
  const cancelButton = document.getElementById('member-cancel');
  const manageList = document.getElementById('about-manage-list');

  let session = null;
  let isOwner = false;
  let members = [];
  let editingId = null;

  function setStatus(element, message, isError) {
    element.textContent = message;
    element.classList.toggle('roadmap-error', Boolean(isError));
  }

  function updateAuthControls() {
    const signedIn = Boolean(session);
    loginButton.hidden = signedIn;
    logoutButton.hidden = !signedIn;
    ownerPanel.hidden = !isOwner;
    ownerLoginHint.hidden = isOwner;
    if (signedIn && !isOwner) {
      ownerLoginHint.textContent = 'Je bent ingelogd, maar dit account heeft geen ownerrechten.';
    }
  }

  function renderGroup(category) {
    const list = groups[category];
    list.replaceChildren();
    const categoryMembers = members.filter((member) => member.category === category);
    if (!categoryMembers.length) {
      const empty = document.createElement('li');
      empty.className = 'about-team-empty';
      empty.textContent = 'Er zijn nog geen teamleden toegevoegd.';
      list.appendChild(empty);
      return;
    }

    categoryMembers.forEach((member) => {
      const card = document.createElement('li');
      card.className = 'about-team-card';
      const name = document.createElement('h3');
      name.textContent = member.name;
      const role = document.createElement('p');
      role.className = 'about-team-role';
      role.textContent = member.role;
      card.append(name, role);
      if (member.bio) {
        const bio = document.createElement('p');
        bio.className = 'about-team-bio';
        bio.textContent = member.bio;
        card.appendChild(bio);
      }
      list.appendChild(card);
    });
  }

  function renderMembers() {
    Object.keys(groups).forEach(renderGroup);
    renderManageList();
  }

  function renderManageList() {
    manageList.replaceChildren();
    if (!members.length) {
      const empty = document.createElement('li');
      empty.className = 'about-team-empty';
      empty.textContent = 'Nog geen teamleden om te beheren.';
      manageList.appendChild(empty);
      return;
    }

    members.forEach((member) => {
      const item = document.createElement('li');
      item.className = 'about-manage-item';
      const details = document.createElement('div');
      const name = document.createElement('strong');
      name.textContent = member.name;
      const description = document.createElement('small');
      description.textContent = `${categoryLabels[member.category]} · ${member.role}`;
      details.append(name, description);

      const actions = document.createElement('div');
      actions.className = 'about-manage-actions';
      const editButton = document.createElement('button');
      editButton.className = 'secondary';
      editButton.type = 'button';
      editButton.textContent = 'Bewerken';
      editButton.addEventListener('click', () => beginEdit(member));
      const deleteButton = document.createElement('button');
      deleteButton.className = 'secondary';
      deleteButton.type = 'button';
      deleteButton.textContent = 'Verwijderen';
      deleteButton.addEventListener('click', () => {
        void deleteMember(member);
      });
      actions.append(editButton, deleteButton);
      item.append(details, actions);
      manageList.appendChild(item);
    });
  }

  async function loadMembers() {
    setStatus(aboutStatus, 'Teamleden laden…', false);
    const data = await siteAuth.request(
      '/rest/v1/about_team_members?select=id,category,name,role,bio,sort_order&order=category.asc,sort_order.asc,name.asc'
    );
    if (!Array.isArray(data)) throw new Error('Supabase gaf geen geldige teamgegevens terug.');
    members = data.map((member) => {
      if (
        !member ||
        typeof member.id !== 'string' ||
        !Object.prototype.hasOwnProperty.call(categoryLabels, member.category) ||
        typeof member.name !== 'string' ||
        typeof member.role !== 'string' ||
        typeof member.bio !== 'string' ||
        !Number.isSafeInteger(Number(member.sort_order))
      ) {
        throw new Error('Supabase gaf een ongeldig teamlid terug.');
      }
      return {
        id: member.id,
        category: member.category,
        name: member.name,
        role: member.role,
        bio: member.bio,
        sortOrder: Number(member.sort_order),
      };
    });
    renderMembers();
    setStatus(aboutStatus, 'Team bijgewerkt.', false);
  }

  function resetForm() {
    form.reset();
    categoryInput.value = 'head_dev';
    orderInput.value = '10';
    editingId = null;
    saveButton.textContent = 'Lid toevoegen';
    cancelButton.hidden = true;
  }

  function beginEdit(member) {
    editingId = member.id;
    categoryInput.value = member.category;
    nameInput.value = member.name;
    roleInput.value = member.role;
    bioInput.value = member.bio;
    orderInput.value = String(member.sortOrder);
    saveButton.textContent = 'Wijzigingen opslaan';
    cancelButton.hidden = false;
    setStatus(ownerStatus, `Je bewerkt ${member.name}.`, false);
    form.scrollIntoView({ behavior: 'smooth', block: 'center' });
    nameInput.focus();
  }

  async function saveMember(event) {
    event.preventDefault();
    if (!isOwner || !session) {
      setStatus(ownerStatus, 'Log in als owner om teamleden te beheren.', true);
      return;
    }
    const name = nameInput.value.trim();
    const role = roleInput.value.trim();
    const bio = bioInput.value.trim();
    const sortOrder = Number(orderInput.value);
    if (
      name.length < 2 ||
      name.length > 80 ||
      role.length < 2 ||
      role.length > 80 ||
      bio.length > 500 ||
      !Number.isSafeInteger(sortOrder) ||
      sortOrder < 0 ||
      sortOrder > 10000
    ) {
      setStatus(ownerStatus, 'Controleer de naam, rol, bio en volgorde.', true);
      return;
    }
    if (
      categoryInput.value === 'head_dev' &&
      members.some((member) => member.category === 'head_dev' && member.id !== editingId)
    ) {
      setStatus(ownerStatus, 'Er kan maar één head developer worden ingesteld. Bewerk het bestaande profiel.', true);
      return;
    }

    saveButton.disabled = true;
    setStatus(ownerStatus, 'Wijzigingen opslaan…', false);
    const payload = {
      category: categoryInput.value,
      name,
      role,
      bio,
      sort_order: sortOrder,
      updated_by: session.userId,
      updated_at: new Date().toISOString(),
    };
    try {
      if (editingId) {
        await siteAuth.request(`/rest/v1/about_team_members?id=eq.${encodeURIComponent(editingId)}`, {
          method: 'PATCH',
          session,
          body: payload,
        });
      } else {
        payload.created_by = session.userId;
        await siteAuth.request('/rest/v1/about_team_members', {
          method: 'POST',
          session,
          body: payload,
        });
      }
      resetForm();
      await loadMembers();
      setStatus(ownerStatus, 'Teamlid opgeslagen.', false);
    } catch (error) {
      console.error('Teamlid kon niet worden opgeslagen.', error);
      setStatus(ownerStatus, `Opslaan mislukt: ${error.message}`, true);
    } finally {
      saveButton.disabled = false;
    }
  }

  async function deleteMember(member) {
    if (!isOwner || !session || !window.confirm(`Weet je zeker dat je ${member.name} wilt verwijderen?`)) return;
    setStatus(ownerStatus, 'Teamlid verwijderen…', false);
    try {
      await siteAuth.request(`/rest/v1/about_team_members?id=eq.${encodeURIComponent(member.id)}`, {
        method: 'DELETE',
        session,
      });
      if (editingId === member.id) resetForm();
      await loadMembers();
      setStatus(ownerStatus, 'Teamlid verwijderd.', false);
    } catch (error) {
      console.error('Teamlid kon niet worden verwijderd.', error);
      setStatus(ownerStatus, `Verwijderen mislukt: ${error.message}`, true);
    }
  }

  loginButton.addEventListener('click', async () => {
    loginButton.disabled = true;
    setStatus(authStatus, 'Google-login openen…', false);
    try {
      await siteAuth.login();
    } catch (error) {
      console.error('Google-login kon niet worden gestart.', error);
      setStatus(authStatus, `Inloggen mislukt: ${error.message}`, true);
      loginButton.disabled = false;
    }
  });

  logoutButton.addEventListener('click', async () => {
    if (!session) return;
    logoutButton.disabled = true;
    setStatus(authStatus, 'Uitloggen…', false);
    try {
      await siteAuth.logout(session);
      session = null;
      isOwner = false;
      updateAuthControls();
      setStatus(authStatus, 'Je bent uitgelogd.', false);
    } catch (error) {
      console.error('Uitloggen is mislukt.', error);
      setStatus(authStatus, `Uitloggen mislukt: ${error.message}`, true);
    } finally {
      logoutButton.disabled = false;
    }
  });

  form.addEventListener('submit', (event) => {
    void saveMember(event);
  });
  cancelButton.addEventListener('click', () => {
    resetForm();
    setStatus(ownerStatus, 'Bewerken geannuleerd.', false);
  });

  async function initialize() {
    try {
      await loadMembers();
    } catch (error) {
      console.error('Teamleden konden niet worden geladen.', error);
      setStatus(aboutStatus, `Team laden mislukt: ${error.message}`, true);
    }

    try {
      session = await siteAuth.initialize();
      isOwner = session ? await siteAuth.isOwner(session) : false;
      updateAuthControls();
    } catch (error) {
      console.error('Website-login kon niet worden hersteld.', error);
      setStatus(authStatus, `Inloggen mislukt: ${error.message}`, true);
      loginButton.hidden = false;
      logoutButton.hidden = true;
      ownerPanel.hidden = true;
      isOwner = false;
    }
  }

  void initialize();
})();
